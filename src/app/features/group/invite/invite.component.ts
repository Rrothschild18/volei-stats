import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MembershipService } from '../../../core/identity';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import {
  BlueprintComponent,
  IconComponent,
  InlineNoteComponent,
  InnerHeaderComponent,
} from '../../../shared/ui';
import { describeError } from '../../../shared/utils/error.util';

/**
 * O convite do vôlei: o código e o link que vão para o grupo do zap.
 *
 * Um convite, reutilizável de propósito — serve para o grupo todo, e a mesma
 * pessoa usa no celular e no tablet. Cancelar gera outro código: é assim que se
 * tranca quem não deveria ter entrado, porque o id do vôlei nunca muda e
 * trancar por ele não trancaria nada.
 *
 * O código vai acompanhado da data inicial do grupo, que a tela **não mostra**:
 * ela é senha, e o banco não a entrega a cliente nenhum. Quem a sabe é quem
 * criou o vôlei.
 */
@Component({
  selector: 'app-invite',
  imports: [BlueprintComponent, IconComponent, InlineNoteComponent, InnerHeaderComponent],
  template: `
    <app-inner-header context="VÔLEI" title="CONVITE" (back)="back()" />

    <div class="flex flex-col gap-5 px-4 pb-8">
      @if (loading()) {
        <p class="text-[13px] muted">Carregando o convite…</p>
      } @else if (code() === null) {
        <app-blueprint class="p-4">
          <p class="text-[14px]">Este vôlei não tem convite aberto.</p>
        </app-blueprint>
        <button type="button" class="btn btn-primary h-13" (click)="renew()">GERAR CONVITE</button>
      } @else {
        <app-blueprint class="p-4">
          <p class="kicker">CÓDIGO DO VÔLEI</p>
          <p class="mt-1 font-heading text-[34px] leading-none font-semibold tracking-[0.12em]">
            {{ code() }}
          </p>
          <p class="mt-3 text-[13px] muted">
            Mande o código <strong class="font-semibold">e a data inicial do grupo</strong> para a
            pessoa. Ela toca no nome dela e troca a data pela dela.
          </p>
        </app-blueprint>

        <div class="grid grid-cols-2 gap-2">
          <button type="button" class="btn btn-secondary min-h-12" (click)="copyLink()">
            COPIAR LINK
          </button>
          <button type="button" class="btn btn-secondary min-h-12" (click)="share()">
            <app-icon name="send" [size]="18" />
            NO ZAP
          </button>
        </div>

        <div aria-live="polite">
          @if (notice()) {
            <app-inline-note tone="event">{{ notice() }}</app-inline-note>
          }
          @if (error()) {
            <app-inline-note tone="error">{{ error() }}</app-inline-note>
          }
        </div>

        <div class="border-t border-divider pt-5">
          <p class="kicker">ESCOLHER O CÓDIGO</p>
          <div class="field mt-3">
            <label for="invite-code">Código novo</label>
            <input
              id="invite-code"
              class="input font-heading tracking-[0.12em] uppercase"
              type="text"
              autocapitalize="characters"
              autocomplete="off"
              spellcheck="false"
              aria-describedby="invite-code-help"
              [value]="draft()"
              (input)="draft.set($any($event.target).value)"
            />
            <p id="invite-code-help" class="mt-2 text-[12px] muted">
              Letras, números e hífen. Tem de ser único entre todos os vôleis.
            </p>
          </div>
          <button
            type="button"
            class="btn btn-secondary mt-3 min-h-12 w-full"
            [disabled]="!canRename()"
            (click)="rename()"
          >
            TROCAR O CÓDIGO
          </button>
        </div>

        <div class="border-t border-divider pt-5">
          <p class="kicker">CANCELAR ESTE CONVITE</p>
          <p class="mt-1 text-[13px] muted">
            O código atual para de funcionar e um novo é gerado. Quem já entrou continua dentro.
          </p>
          <button type="button" class="btn btn-secondary mt-3 min-h-12 w-full" (click)="renew()">
            CANCELAR E GERAR OUTRO
          </button>
        </div>

        <div class="border-t border-divider pt-5">
          <p class="kicker">O PESSOAL</p>
          <p class="mt-1 text-[13px] muted">
            Cadastre cada pessoa com nome e sexo. A data você não escolhe: todos entram com a
            inicial do grupo e trocam pela deles.
          </p>
          <button type="button" class="btn btn-primary mt-3 min-h-12 w-full" (click)="players()">
            CADASTRAR JOGADORES
          </button>
        </div>
      }
    </div>
  `,
  host: { class: 'block' },
})
export class InviteComponent implements OnInit {
  private readonly membership = inject(MembershipService);
  private readonly group = inject(CurrentGroupStore);
  private readonly router = inject(Router);

  protected readonly code = signal<string | null>(null);
  protected readonly draft = signal('');
  protected readonly loading = signal(true);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly canRename = computed(() => this.draft().trim().length >= 3);

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    const groupId = this.group.groupId();
    if (!groupId) {
      return;
    }
    this.loading.set(true);
    try {
      const invite = await this.membership.invite(groupId);
      this.code.set(invite?.code ?? null);
    } catch (cause) {
      this.error.set(describeError(cause, 'Não foi possível ler o convite.'));
    } finally {
      this.loading.set(false);
    }
  }

  private link(): string {
    return `${location.origin}${location.pathname.replace(/\/$/, '')}#/entrar/${this.code()}`;
  }

  protected async copyLink(): Promise<void> {
    this.error.set(null);
    try {
      await navigator.clipboard.writeText(this.link());
      this.notice.set('Link copiado.');
    } catch {
      // Área de transferência bloqueada: mostra o link para copiar à mão.
      this.notice.set(this.link());
    }
  }

  protected async share(): Promise<void> {
    const text = `Entra no vôlei: código ${this.code()} — ${this.link()}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // Cancelou o compartilhamento: nada a fazer.
        return;
      }
    }
    await this.copyLink();
  }

  protected async rename(): Promise<void> {
    const groupId = this.group.groupId();
    if (!groupId || !this.canRename()) {
      return;
    }
    this.error.set(null);
    this.notice.set(null);
    try {
      const invite = await this.membership.setInviteCode(
        groupId,
        this.draft().trim().toUpperCase(),
      );
      this.code.set(invite.code);
      this.draft.set('');
      this.notice.set('Código trocado.');
    } catch (cause) {
      this.error.set(describeError(cause, 'Não foi possível trocar o código.'));
    }
  }

  protected async renew(): Promise<void> {
    const groupId = this.group.groupId();
    if (!groupId) {
      return;
    }
    this.error.set(null);
    this.notice.set(null);
    try {
      const invite = await this.membership.renewInvite(groupId);
      this.code.set(invite.code);
      this.notice.set('Convite novo gerado. O código antigo não entra mais.');
    } catch (cause) {
      this.error.set(describeError(cause, 'Não foi possível gerar o convite.'));
    }
  }

  protected players(): void {
    void this.router.navigate(['/g', this.group.groupId(), 'jogadores']);
  }

  protected back(): void {
    void this.router.navigate(['/g', this.group.groupId(), 'inicio']);
  }
}
