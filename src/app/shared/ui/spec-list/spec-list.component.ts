import { Component, input } from '@angular/core';

export interface SpecListItem {
  readonly label: string;
  readonly value: string;
  readonly figure?: string | number;
}

/** Lista numerada dentro de uma moldura: destaques, revezamento, prioridades. */
@Component({
  selector: 'app-spec-list',
  template: `
    @for (item of items(); track $index; let last = $last) {
      <div
        class="grid grid-cols-[26px_1fr_auto] items-center gap-2 px-[14px] py-[11px]"
        [class.row-rule]="!last || !!note()"
      >
        <span class="text-[12px] font-semibold text-accent-700 tnum">{{ number($index) }}</span>
        <span>
          <span class="block text-[13px] muted">{{ item.label }}</span>
          <span class="block text-[19px] leading-tight font-heading font-semibold uppercase">
            {{ item.value }}
          </span>
        </span>
        @if (item.figure !== undefined) {
          <span class="text-[26px] leading-none font-heading font-semibold tnum">
            {{ item.figure }}
          </span>
        }
      </div>
    }
    @if (note()) {
      <p class="px-[14px] py-[10px] text-[12px] muted">{{ note() }}</p>
    }
  `,
})
export class SpecListComponent {
  readonly items = input.required<readonly SpecListItem[]>();
  readonly note = input<string | null>(null);

  protected number(index: number): string {
    return String(index + 1).padStart(2, '0');
  }
}
