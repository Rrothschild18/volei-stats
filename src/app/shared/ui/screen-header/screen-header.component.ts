import { Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * Header de tela raiz: o botão que troca de vôlei, a tag de papel e o título
 * grande. O nome do grupo abre de volta a lista "Seus vôleis".
 *
 * O `slot=action` fica na LINHA DO TÍTULO, à direita. É onde mora o botão de
 * atualizar: antes ele tinha uma faixa só dele, que não carregava nada além do
 * próprio botão e comia uma banda inteira de altura na primeira dobra.
 */
@Component({
  selector: 'app-root-header',
  imports: [IconComponent],
  template: `
    <div class="flex items-center justify-between gap-2">
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
    <div class="mt-1 flex items-center justify-between gap-2">
      <h1 class="title-xl">{{ title() }}</h1>
      <ng-content select="[slot=action]" />
    </div>
  `,
  host: { class: 'block border-b border-divider px-4 pt-[6px] pb-[14px]' },
})
export class RootHeaderComponent {
  /** "VÔLEI SEGUNDA · SEG 26 OUT" */
  readonly context = input.required<string>();
  readonly title = input.required<string>();
  readonly switchGroup = output<void>();
}
