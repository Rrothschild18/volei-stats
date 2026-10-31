import { Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/** Header de tela interna: voltar, kicker de contexto, título e ação à direita. */
@Component({
  selector: 'app-inner-header',
  imports: [IconComponent],
  template: `
    <button
      type="button"
      class="btn btn-ghost btn-icon border-0"
      aria-label="Voltar"
      (click)="back.emit()"
    >
      <app-icon name="chevron-left" [size]="24" />
    </button>
    <div class="min-w-0 flex-1">
      @if (context()) {
        <p class="kicker">{{ context() }}</p>
      }
      <h1 class="font-heading text-[28px] leading-none font-semibold uppercase">{{ title() }}</h1>
    </div>
    <ng-content />
  `,
  host: { class: 'flex items-center gap-1 pt-[2px] pr-4 pb-3 pl-1' },
})
export class InnerHeaderComponent {
  readonly context = input<string | null>(null);
  readonly title = input.required<string>();
  readonly back = output<void>();
}
