import { Component, input } from '@angular/core';

export interface StatGridItem {
  readonly value: string | number;
  readonly label: string;
}

/** Grade de números com filete, 3 colunas por padrão (4 no card de formato). */
@Component({
  selector: 'app-stat-grid',
  template: `
    @for (item of items(); track item.label) {
      <div class="px-3 pt-3 pb-[10px] not-first:border-l not-first:border-divider">
        <p class="figure">{{ item.value }}</p>
        <p class="text-[12px] leading-4 muted">{{ item.label }}</p>
      </div>
    }
  `,
  host: {
    class: 'grid border border-accent-200 bg-accent-100',
    '[style.grid-template-columns]': '"repeat(" + columns() + ", minmax(0, 1fr))"',
  },
})
export class StatGridComponent {
  readonly items = input.required<readonly StatGridItem[]>();
  readonly columns = input(3);
}
