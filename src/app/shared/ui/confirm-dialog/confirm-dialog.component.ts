import { Component, input, output } from '@angular/core';
import { BlueprintComponent } from '../blueprint/blueprint.component';
import { BusyDirective } from '../busy.directive';
import { FocusTrapDirective } from '../focus-trap.directive';

/**
 * A confirmação de uma coisa que não tem como desfazer.
 *
 * Existe porque a frase sobre apagar coisa alheia passou a ter dois donos — a
 * classificação e a lista de campeonatos (ticket 45) —, e duas cópias dela é
 * como uma delas fica para trás.
 *
 * O diálogo fica aberto enquanto o banco responde: fechar antes deixaria a
 * pessoa olhando uma tela que já está sendo desmontada, sem saber se funcionou.
 * Daí `busy` vir de fora, e cancelar estar desabilitado enquanto dura.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [BlueprintComponent, BusyDirective, FocusTrapDirective],
  template: `
    <div class="dialog-backdrop items-center">
      <app-blueprint
        class="dialog"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        appFocusTrap
        [appFocusTrapDismissible]="!busy()"
        (escape)="canceled.emit()"
      >
        <h3 class="font-heading text-[20px] font-semibold uppercase">{{ title() }}</h3>
        <p class="text-[14px]">{{ message() }}</p>
        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="btn btn-secondary"
            [disabled]="busy()"
            (click)="canceled.emit()"
          >
            {{ cancelLabel() }}
          </button>
          <button
            type="button"
            class="btn btn-danger"
            [appBusy]="busy()"
            [disabled]="busy()"
            (click)="confirmed.emit()"
          >
            {{ confirmLabel() }}
          </button>
        </div>
      </app-blueprint>
    </div>
  `,
})
export class ConfirmDialogComponent {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('EXCLUIR');
  readonly cancelLabel = input('CANCELAR');
  /** Gravando: o diálogo não fecha e nada mais é tocável. */
  readonly busy = input(false);

  readonly confirmed = output<void>();
  readonly canceled = output<void>();
}
