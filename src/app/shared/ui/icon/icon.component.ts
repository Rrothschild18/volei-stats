import { Component, computed, input } from '@angular/core';
import { ICONS, IconName } from './icon-data';

/**
 * Ícone Lucide desenhado inline. Decorativo por padrão: quem usa um ícone como
 * único conteúdo de um botão põe o `aria-label` no botão, não aqui.
 */
@Component({
  selector: 'app-icon',
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @for (node of nodes(); track $index) {
        @switch (node.tag) {
          @case ('path') {
            <svg:path [attr.d]="node.attrs['d']" />
          }
          @case ('circle') {
            <svg:circle
              [attr.cx]="node.attrs['cx']"
              [attr.cy]="node.attrs['cy']"
              [attr.r]="node.attrs['r']"
            />
          }
          @case ('rect') {
            <svg:rect
              [attr.x]="node.attrs['x']"
              [attr.y]="node.attrs['y']"
              [attr.width]="node.attrs['width']"
              [attr.height]="node.attrs['height']"
              [attr.rx]="node.attrs['rx']"
              [attr.ry]="node.attrs['ry']"
            />
          }
          @case ('line') {
            <svg:line
              [attr.x1]="node.attrs['x1']"
              [attr.y1]="node.attrs['y1']"
              [attr.x2]="node.attrs['x2']"
              [attr.y2]="node.attrs['y2']"
            />
          }
        }
      }
    </svg>
  `,
  host: { class: 'inline-flex shrink-0' },
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly strokeWidth = input(1.5);

  protected readonly nodes = computed(() => ICONS[this.name()] ?? []);
}
