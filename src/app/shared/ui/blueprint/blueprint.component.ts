import { Component, input } from '@angular/core';

/**
 * Moldura padrão do sistema: filete de 1px e as quatro marcas "+" nos cantos.
 * Sem preenchimento de fundo — o objeto é desenhado, não preenchido.
 */
@Component({
  selector: 'app-blueprint',
  template: `
    <i class="corner tl"></i>
    <i class="corner tr"></i>
    <i class="corner bl"></i>
    <i class="corner br"></i>
    <ng-content />
  `,
  host: {
    class: 'blueprint block',
    '[attr.data-selected]': 'selected()',
  },
})
export class BlueprintComponent {
  /** Card selecionado troca o filete para o acento. */
  readonly selected = input(false);
}
