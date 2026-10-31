import { Component, computed, input, model } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * Stepper de 1 em 1. A variante compacta é o limite de pontos; a grande é o
 * placar, com o número em 64px e algarismos de largura fixa.
 */
@Component({
  selector: 'app-stepper',
  imports: [IconComponent],
  template: `
    <button
      type="button"
      class="btn btn-ghost border-0"
      [class]="buttonSize()"
      [disabled]="value() <= min()"
      [attr.aria-label]="'Diminuir ' + label()"
      (click)="step(-1)"
    >
      <app-icon name="minus" [size]="large() ? 26 : 20" />
    </button>
    <output
      class="flex items-center justify-center font-heading font-semibold tnum"
      [class]="valueSize()"
      [attr.aria-label]="label()"
      >{{ value() }}</output
    >
    <button
      type="button"
      class="btn btn-ghost border-0"
      [class]="buttonSize()"
      [attr.aria-label]="'Aumentar ' + label()"
      (click)="step(1)"
    >
      <app-icon name="plus" [size]="large() ? 26 : 20" />
    </button>
  `,
  host: {
    class: 'grid items-center',
    '[class]': 'frame()',
  },
})
export class StepperComponent {
  readonly value = model.required<number>();
  readonly min = input(0);
  readonly label = input.required<string>();
  /** Variante do placar. */
  readonly large = input(false);

  protected readonly frame = computed(() =>
    this.large()
      ? 'grid-cols-[64px_1fr_64px] h-16'
      : 'grid-cols-[44px_44px_44px] border border-divider',
  );

  protected readonly buttonSize = computed(() => (this.large() ? 'h-16' : 'size-11'));

  protected readonly valueSize = computed(() =>
    this.large()
      ? 'text-[64px] leading-none'
      : 'text-[24px] leading-none h-11 border-x border-divider',
  );

  protected step(delta: number): void {
    this.value.update((current) => Math.max(this.min(), current + delta));
  }
}
