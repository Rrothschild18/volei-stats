import { Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { BlueprintComponent } from '../blueprint/blueprint.component';
import { FocusTrapDirective } from '../focus-trap.directive';

/**
 * Sheet que entra de baixo. As decisões que pausam a chave (par-ou-ímpar,
 * desempate) não fecham por Esc nem por toque no fundo: alguém precisa
 * registrar o que aconteceu na quadra.
 */
@Component({
  selector: 'app-bottom-sheet',
  imports: [IconComponent, BlueprintComponent, FocusTrapDirective],
  template: `
    <div class="dialog-backdrop items-end">
      @if (dismissible()) {
        <!-- Fundo clicável que o teclado também alcança. -->
        <button
          type="button"
          class="absolute inset-0 cursor-default"
          aria-label="Fechar"
          (click)="dismiss.emit()"
        ></button>
      }
      <app-blueprint
        class="dialog relative animate-[sheet-in_200ms_ease-out]"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        appFocusTrap
        [appFocusTrapDismissible]="dismissible()"
        (escape)="dismiss.emit()"
      >
        <div class="flex items-start justify-between gap-2">
          <div>
            @if (kicker()) {
              <p class="kicker">{{ kicker() }}</p>
            }
            <h2 class="title-lg">{{ title() }}</h2>
          </div>
          @if (dismissible()) {
            <button
              type="button"
              class="btn btn-ghost btn-icon"
              aria-label="Fechar"
              (click)="dismiss.emit()"
            >
              <app-icon name="x" [size]="24" />
            </button>
          }
        </div>
        <ng-content />
      </app-blueprint>
    </div>
  `,
  styles: `
    @keyframes sheet-in {
      from {
        transform: translateY(16px);
      }
      to {
        transform: translateY(0);
      }
    }
  `,
})
export class BottomSheetComponent {
  readonly title = input.required<string>();
  readonly kicker = input<string | null>(null);
  /** As decisões de quadra não são dispensáveis. */
  readonly dismissible = input(true);
  readonly dismiss = output<void>();
}
