import { Component, computed, inject, input, signal } from '@angular/core';
import { linhasDoResumo } from '../../../core/rules/session-summary-lines';
import { resumoDaSessao } from '../../../core/rules/session-summary';
import { SummaryShareService } from '../../../core/services/summary-share.service';
import { Match, Player, Tournament } from '../../../shared/models';
import { BusyDirective, IconComponent } from '../../../shared/ui';

/**
 * NO ZAP: o resumo da noite vira imagem e vai para o grupo (ticket 03).
 *
 * Mora no resumo da sessão e na listagem de campeonatos — e não mais no fim de
 * cada jogo, onde o que a pessoa quer é ver a chave.
 */
@Component({
  selector: 'app-summary-share-button',
  imports: [BusyDirective, IconComponent],
  template: `
    @if (linhas().length > 0) {
      <button
        type="button"
        class="btn btn-secondary h-12 w-full"
        [class]="compacto() ? 'px-3' : ''"
        [appBusy]="ocupado()"
        [disabled]="ocupado()"
        aria-label="Compartilhar o resumo da noite no WhatsApp"
        (click)="compartilhar()"
      >
        <app-icon name="send" [size]="18" />
        NO ZAP
      </button>
      <p class="text-[12px] muted" [class.mt-2]="!!aviso()" aria-live="polite">{{ aviso() }}</p>
    }
  `,
  host: { class: 'block' },
})
export class SummaryShareButtonComponent {
  private readonly share = inject(SummaryShareService);

  readonly tournaments = input.required<readonly Tournament[]>();
  readonly matches = input.required<readonly Match[]>();
  readonly playersById = input.required<ReadonlyMap<string, Player>>();
  /** O vôlei e o dia: o cabeçalho da imagem. */
  readonly titulo = input.required<string>();
  readonly subtitulo = input.required<string>();
  readonly compacto = input(false);

  protected readonly ocupado = signal(false);
  protected readonly aviso = signal('');

  protected readonly linhas = computed(() =>
    linhasDoResumo(
      resumoDaSessao({ tournaments: this.tournaments(), matches: this.matches() }),
      (playerId) => this.playersById().get(playerId)?.name ?? '?',
    ),
  );

  protected async compartilhar(): Promise<void> {
    this.ocupado.set(true);
    this.aviso.set('');
    try {
      const resultado = await this.share.compartilhar({
        titulo: this.titulo(),
        subtitulo: this.subtitulo(),
        linhas: this.linhas(),
      });

      // No celular o próprio sistema mostra o que fez. No computador a imagem
      // foi para Downloads e o WhatsApp abriu com texto: isso precisa ser dito.
      if (resultado === 'baixado') {
        this.aviso.set(
          'A imagem foi baixada e o WhatsApp abriu com o resumo em texto. Anexe a imagem na conversa.',
        );
      }
    } catch {
      this.aviso.set('Não deu para montar a imagem agora. Tente de novo.');
    } finally {
      this.ocupado.set(false);
    }
  }
}
