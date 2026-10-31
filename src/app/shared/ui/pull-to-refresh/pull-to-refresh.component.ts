import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RefreshService } from '../../../core/refresh/refresh.service';
import { IconComponent } from '../icon/icon.component';

/** Quanto puxar antes de valer. */
const THRESHOLD = 72;

/**
 * Puxar para atualizar, no topo das telas de lista.
 *
 * Escuta o gesto no documento em vez de envolver o conteúdo: assim entra numa
 * linha em cada tela, e a tela não precisa ser remontada em volta dela.
 *
 * O botão ao lado não é enfeite: puxar é um gesto de trajetória, e a WCAG 2.1
 * (2.5.1) exige que tudo que se faça com gesto também se faça com um toque só.
 * Quem usa teclado ou leitor de tela usa o botão; quem está com a mão na tela
 * puxa.
 */
@Component({
  selector: 'app-pull-to-refresh',
  imports: [IconComponent],
  template: `
    <div class="flex min-h-7 items-center justify-between gap-2 px-4 text-[12px] muted">
      <span aria-live="polite">
        @if (refresh.refreshing()) {
          Atualizando…
        } @else if (pulled() >= THRESHOLD) {
          Solte para atualizar
        } @else if (pulled() > 0) {
          Puxe para atualizar
        }
      </span>

      <button
        type="button"
        class="btn btn-ghost btn-icon border-0"
        aria-label="Atualizar"
        [disabled]="refresh.refreshing()"
        (click)="run()"
      >
        <app-icon name="repeat" [size]="18" />
      </button>
    </div>
  `,
  host: { class: 'block' },
})
export class PullToRefreshComponent {
  protected readonly refresh = inject(RefreshService);
  protected readonly THRESHOLD = THRESHOLD;

  protected readonly pulled = signal(0);
  /** Nulo quando o gesto não começou no topo: aí é rolagem normal. */
  private origin: number | null = null;

  constructor() {
    const start = (event: TouchEvent) => {
      this.origin = window.scrollY <= 0 ? (event.touches[0]?.clientY ?? null) : null;
    };
    const move = (event: TouchEvent) => {
      if (this.origin === null) {
        return;
      }
      const delta = (event.touches[0]?.clientY ?? this.origin) - this.origin;
      // Só para baixo, e com teto: o gesto não vira um elástico infinito.
      this.pulled.set(Math.max(0, Math.min(delta, THRESHOLD * 2)));
    };
    const end = () => {
      const enough = this.pulled() >= THRESHOLD;
      this.origin = null;
      this.pulled.set(0);
      if (enough) {
        this.run();
      }
    };

    document.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchmove', move, { passive: true });
    document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', end);

    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('touchstart', start);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end);
      document.removeEventListener('touchcancel', end);
    });
  }

  protected run(): void {
    void this.refresh.refresh();
  }
}
