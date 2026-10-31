import { Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * Header de tela raiz: o botão que troca de vôlei, a tag de papel e o título
 * grande. O nome do grupo abre de volta a lista "Seus vôleis".
 */
@Component({
  selector: 'app-root-header',
  imports: [IconComponent],
  template: `
    <div class="flex items-start justify-between gap-2">
      <button
        type="button"
        class="btn btn-ghost -ml-1 gap-1 border-0 px-1 normal-case"
        (click)="switchGroup.emit()"
      >
        <span class="kicker">{{ context() }}</span>
        <app-icon name="chevron-down" [size]="14" />
      </button>
      <ng-content select="[slot=role]" />
    </div>
    <h1 class="title-xl mt-1">{{ title() }}</h1>
  `,
  host: { class: 'block border-b border-divider px-4 pt-[6px] pb-[14px]' },
})
export class RootHeaderComponent {
  /** "VÔLEI SEGUNDA · SEG 26 OUT" */
  readonly context = input.required<string>();
  readonly title = input.required<string>();
  readonly switchGroup = output<void>();
}
