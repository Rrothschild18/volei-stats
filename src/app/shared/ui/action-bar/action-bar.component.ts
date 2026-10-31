import { Component, computed, input } from '@angular/core';

/**
 * Rodapé de ação. Com dois botões, o primário ocupa mais espaço que o
 * secundário; sem barra de abas embaixo, ganha folga extra para o safe-area.
 */
@Component({
  selector: 'app-action-bar',
  template: `
    <div class="grid gap-[10px]" [class]="columns()">
      <ng-content />
    </div>
  `,
  host: {
    class: 'sticky bottom-0 block bg-bg border-t border-divider px-4 pt-3',
    '[class]': 'spacing()',
  },
})
export class ActionBarComponent {
  /** Dois botões: secundário e primário. */
  readonly pair = input(false);
  /** Quando há barra de abas abaixo, o respiro embaixo é menor. */
  readonly withTabBar = input(false);

  protected readonly columns = computed(() =>
    this.pair() ? 'grid-cols-[1fr_1.6fr]' : 'grid-cols-1',
  );

  protected readonly spacing = computed(() => (this.withTabBar() ? 'pb-3' : 'pb-[26px]'));
}
