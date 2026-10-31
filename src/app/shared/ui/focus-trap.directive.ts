import { AfterViewInit, Directive, ElementRef, inject, input, output } from '@angular/core';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Prende o foco dentro de um conteúdo modal e manda o Esc para quem o abriu.
 *
 * As decisões que pausam a chave não são dispensáveis: lá o Esc não fecha nada
 * (REGRAS.md §9.3), mas o foco continua preso.
 */
@Directive({
  selector: '[appFocusTrap]',
  host: { '(keydown)': 'onKeydown($event)' },
})
export class FocusTrapDirective implements AfterViewInit {
  /** `false` ignora o Esc: a decisão precisa ser tomada. */
  readonly dismissible = input(true, { alias: 'appFocusTrapDismissible' });
  readonly escape = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  ngAfterViewInit(): void {
    this.focusable()[0]?.focus();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.dismissible()) {
        this.escape.emit();
      }
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const targets = this.focusable();
    if (targets.length === 0) {
      return;
    }

    const first = targets[0];
    const last = targets[targets.length - 1];
    const active = this.host.nativeElement.ownerDocument.activeElement;

    if (event.shiftKey && active === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && active === last) {
      first.focus();
      event.preventDefault();
    }
  }

  private focusable(): HTMLElement[] {
    return [...this.host.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE)];
  }
}
