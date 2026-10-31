import { Component, computed, input, output } from '@angular/core';
import { Gender } from '../../enums';
import { GenderBadgeComponent } from '../gender-badge/gender-badge.component';

/**
 * Chip de jogador. A variante trocável é a do sorteio: o primeiro toque
 * seleciona, o segundo troca os dois de lugar.
 */
@Component({
  selector: 'app-player-chip',
  imports: [GenderBadgeComponent],
  template: `
    @if (selectable()) {
      <button
        type="button"
        class="inline-flex h-9 items-center gap-2 border px-3 text-[14px] font-medium"
        [class]="palette()"
        [attr.aria-pressed]="selected()"
        (click)="picked.emit()"
      >
        {{ name() }}
        @if (gender()) {
          <app-gender-badge [gender]="gender()!" />
        }
      </button>
    } @else {
      <span
        class="inline-flex h-[30px] items-center gap-2 border border-divider px-[10px] text-[13px] font-medium"
      >
        {{ name() }}
        @if (gender()) {
          <app-gender-badge [gender]="gender()!" />
        }
      </span>
    }
  `,
  host: { class: 'inline-flex' },
})
export class PlayerChipComponent {
  readonly name = input.required<string>();
  readonly gender = input<Gender | null>(null);
  readonly selectable = input(false);
  readonly selected = input(false);
  readonly picked = output<void>();

  protected readonly palette = computed(() =>
    this.selected() ? 'bg-accent-700 border-accent-700 text-bg' : 'border-divider',
  );
}
