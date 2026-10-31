import { Component, input, model } from '@angular/core';

/** Toggle quadrado do sistema. Operável por teclado como um `switch`. */
@Component({
  selector: 'app-switch',
  template: '',
  host: {
    role: 'switch',
    tabindex: '0',
    '[attr.aria-checked]': 'checked()',
    '[attr.aria-disabled]': 'disabled() || null',
    '[attr.aria-label]': 'label()',
    '(click)': 'onToggle()',
    '(keydown.space)': 'onKeydown($event)',
    '(keydown.enter)': 'onKeydown($event)',
  },
  styles: `
    :host {
      position: relative;
      display: block;
      width: 48px;
      height: 28px;
      flex: none;
      cursor: pointer;
      border: 1px solid var(--color-neutral-500);
      background: transparent;
    }

    :host::after {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: 20px;
      height: 20px;
      background: var(--color-neutral-500);
    }

    :host([aria-checked='true']) {
      background: var(--color-accent);
      border-color: var(--color-accent);
    }

    :host([aria-checked='true'])::after {
      left: auto;
      right: 3px;
      background: var(--color-bg);
    }

    :host([aria-disabled='true']) {
      opacity: 0.45;
      cursor: not-allowed;
    }
  `,
})
export class SwitchComponent {
  readonly checked = model(false);
  readonly disabled = input(false);
  readonly label = input.required<string>();

  protected onToggle(): void {
    if (this.disabled()) {
      return;
    }
    this.checked.update((value) => !value);
  }

  protected onKeydown(event: Event): void {
    event.preventDefault();
    this.onToggle();
  }
}
