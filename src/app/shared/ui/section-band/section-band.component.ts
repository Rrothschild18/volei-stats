import { Component, computed, input } from '@angular/core';

/**
 * Faixa de título de seção: kicker numerado à esquerda e, à direita, uma meta
 * em texto ou um link projetado.
 */
@Component({
  selector: 'app-section-band',
  template: `
    <span class="kicker">{{ caption() }}</span>
    @if (meta()) {
      <span class="text-[13px] muted">{{ meta() }}</span>
    }
    <ng-content />
  `,
  host: {
    class: 'flex items-baseline justify-between gap-2 px-[10px] py-2 bg-accent-100 mb-3',
  },
})
export class SectionBandComponent {
  /** Número da seção na tela, como "01". Opcional. */
  readonly index = input<string | null>(null);
  readonly label = input.required<string>();
  readonly meta = input<string | null>(null);

  protected readonly caption = computed(() => {
    const index = this.index();
    return index ? `${index} · ${this.label()}` : this.label();
  });
}
