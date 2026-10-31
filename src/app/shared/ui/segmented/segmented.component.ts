import { Component, computed, input, model } from '@angular/core';

export interface SegmentedOption {
  readonly id: string;
  readonly label: string;
}

/**
 * Abas internas e filtros. Como aba, segue `role="tablist"`; como filtro, é um
 * grupo de botões com o selecionado em acento.
 */
@Component({
  selector: 'app-segmented',
  template: `
    @for (option of options(); track option.id; let first = $first) {
      <button
        type="button"
        class="flex h-11 items-center justify-center font-heading text-[14px] font-semibold tracking-[0.08em] uppercase"
        [class]="optionClass(option.id, first)"
        [attr.role]="tabs() ? 'tab' : null"
        [attr.aria-selected]="tabs() ? option.id === value() : null"
        [attr.aria-pressed]="tabs() ? null : option.id === value()"
        (click)="value.set(option.id)"
      >
        {{ option.label }}
      </button>
    }
  `,
  host: {
    class: 'grid',
    '[attr.role]': 'tabs() ? "tablist" : "group"',
    '[class]': 'frame()',
    '[style.grid-template-columns]': '"repeat(" + options().length + ", minmax(0, 1fr))"',
  },
})
export class SegmentedComponent {
  readonly options = input.required<readonly SegmentedOption[]>();
  readonly value = model.required<string>();
  /** `false` desenha a variante de filtro. */
  readonly tabs = input(true);

  protected readonly frame = computed(() =>
    this.tabs() ? 'border-y border-divider' : 'border border-divider',
  );

  protected optionClass(id: string, first: boolean): string {
    const active = id === this.value();
    const edge = first ? '' : 'border-l border-divider';

    if (this.tabs()) {
      return active
        ? `bg-accent-100 text-accent-800 shadow-[inset_0_-2px_0_var(--color-accent)] ${edge}`
        : `muted ${edge}`;
    }

    return active ? `bg-accent-700 text-bg ${edge}` : `${edge}`;
  }
}
