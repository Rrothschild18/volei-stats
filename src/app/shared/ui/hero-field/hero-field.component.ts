import { Component, input } from '@angular/core';

/**
 * Bloco azul-escuro de destaque: o jogo em quadra, o seu próximo jogo, a
 * presença. No máximo um ou dois por tela.
 */
@Component({
  selector: 'app-hero-field',
  template: `
    @if (kicker()) {
      <p
        class="flex items-center gap-2 text-[12px] leading-4 font-semibold tracking-[0.08em] uppercase text-accent-300"
      >
        @if (live()) {
          <!-- O "ao vivo" é um quadrado estático: nada pisca na quadra. -->
          <span class="size-[7px] bg-accent-300" aria-hidden="true"></span>
        }
        {{ kicker() }}
      </p>
    }
    <ng-content />
  `,
  host: { class: 'flex flex-col gap-3 bg-accent-900 text-bg p-4' },
})
export class HeroFieldComponent {
  readonly kicker = input<string | null>(null);
  readonly live = input(false);
}
