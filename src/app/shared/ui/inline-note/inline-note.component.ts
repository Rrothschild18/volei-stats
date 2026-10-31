import { Component, computed, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icon-data';

/** Positiva, erro de validação ou evento de quadra. O sistema não tem vermelho. */
export type NoteTone = 'positive' | 'error' | 'event';

@Component({
  selector: 'app-inline-note',
  imports: [IconComponent],
  template: `
    <app-icon [name]="resolvedIcon()" [size]="tone() === 'event' ? 20 : 18" />
    <span class="text-[14px] leading-[1.45]"><ng-content /></span>
  `,
  host: {
    class: 'flex items-start gap-2 px-3 py-[11px]',
    '[class]': 'palette()',
  },
})
export class InlineNoteComponent {
  readonly tone = input.required<NoteTone>();
  readonly icon = input<IconName | null>(null);

  protected readonly resolvedIcon = computed<IconName>(() => {
    const explicit = this.icon();
    if (explicit) {
      return explicit;
    }
    switch (this.tone()) {
      case 'positive':
        return 'circle-check';
      case 'error':
        return 'triangle-alert';
      default:
        return 'hand';
    }
  });

  protected readonly palette = computed(() => {
    switch (this.tone()) {
      case 'positive':
        return 'bg-accent-100 text-accent-800';
      case 'error':
        return 'border border-dashed border-accent-800 text-accent-900 font-medium';
      default:
        return 'border border-dashed border-neutral-500';
    }
  });
}
