import { Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icon-data';

/**
 * Convite flutuante: uma ação oportuna que **aparece** quando passa a fazer
 * sentido, por cima do conteúdo rolável (ticket 37).
 *
 * Ele aparecendo já é a informação. Por isso não existe desabilitado desde o
 * começo — e por isso tem de ser anunciado: quem usa leitor de tela não vê um
 * botão surgir. A região `aria-live="polite"` vive sempre no DOM, vazia
 * enquanto não há convite, porque uma região criada junto com o conteúdo não
 * anuncia nada. Polite, não assertive: é oportuno, não urgente.
 *
 * Também não rouba o foco. Ele aparece no meio de outra tarefa — mover o foco
 * interromperia quem está digitando um placar. Entra na ordem de tabulação no
 * lugar que a posição no DOM der, e nada mais.
 *
 * O fundo é sólido de propósito: atrás dele passa lista, então o contraste não
 * pode depender da cor do que está embaixo. O preenchimento é o mesmo do botão
 * primário (accent-700 com texto claro, 5.8:1), e o alvo tem 44 px.
 *
 * Quem o usa reserva o respiro embaixo do conteúdo: flutuante por cima de
 * conteúdo rolável come a última fila da lista.
 */
@Component({
  selector: 'app-floating-invite',
  imports: [IconComponent],
  template: `
    <div class="fixed inset-x-0 bottom-[84px] z-20" aria-live="polite">
      @if (label(); as text) {
        <div class="mx-auto w-full max-w-[480px] px-4">
          <div class="flex items-stretch gap-px bg-accent-900 shadow-lg">
            <button
              type="button"
              class="btn btn-primary min-w-0 flex-1 justify-start gap-2 border-0 text-left"
              (click)="act.emit()"
            >
              <app-icon [name]="icon()" [size]="20" />
              <span class="flex min-w-0 flex-col">
                <span>{{ text }}</span>
                @if (hint(); as detail) {
                  <span class="text-[11px] font-semibold tracking-[0.04em] lowercase">{{
                    detail
                  }}</span>
                }
              </span>
            </button>
            <button
              type="button"
              class="btn btn-primary w-11 border-0 px-0"
              [attr.aria-label]="dismissLabel()"
              (click)="dismissed.emit()"
            >
              <app-icon name="x" [size]="20" />
            </button>
          </div>
        </div>
      }
    </div>
  `,
  host: { class: 'contents' },
})
export class FloatingInviteComponent {
  /**
   * O que ele diz — nulo quando não há convite.
   *
   * O texto precisa dizer **por que agora**, não só o que faz: "sortear o
   * próximo" não explica a aparição, "já dá para sortear o próximo" explica.
   * Um botão redondo só com ícone seria um enigma, porque não existe convenção
   * de ícone para "sortear".
   */
  readonly label = input<string | null>(null);
  readonly hint = input<string | null>(null);
  readonly icon = input<IconName>('dices');
  readonly dismissLabel = input('Descartar aviso');

  readonly act = output<void>();
  readonly dismissed = output<void>();
}
