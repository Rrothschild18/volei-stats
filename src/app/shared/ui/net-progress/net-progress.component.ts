import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { NetworkActivityService } from '../../../core/net/network-activity.service';

/**
 * Atraso antes de a barra aparecer.
 *
 * O banco está longe, mas não toda leitura é lenta. Sem o atraso, cada toque
 * rápido daria um piscar de barra — e barra que pisca lê como defeito, não como
 * espera.
 */
const DELAY_MS = 300;

/**
 * A barra fina no topo: "estou falando com o banco".
 *
 * Ela não bloqueia nada. O que trava é o botão que está esperando — isso é
 * trabalho da tela, com `appBusy`. Aqui é só o aviso de que o app não está
 * parado, e vale para os pedidos que nenhum botão disparou (abrir a tela,
 * renovar o token).
 */
@Component({
  selector: 'app-net-progress',
  template: `
    @if (visible()) {
      <div class="net-progress" role="progressbar" aria-label="Falando com o banco"></div>
    }
  `,
  host: { class: 'contents' },
})
export class NetProgressComponent {
  private readonly activity = inject(NetworkActivityService);

  protected readonly visible = signal(false);

  constructor() {
    let timer: ReturnType<typeof setTimeout> | undefined;

    effect(() => {
      const active = this.activity.active();
      clearTimeout(timer);

      if (active) {
        timer = setTimeout(() => this.visible.set(true), DELAY_MS);
      } else {
        // Sumir é imediato: o pedido acabou, e manter a barra um instante a mais
        // só adiaria a tela nova que já está pronta.
        this.visible.set(false);
      }
    });

    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }
}
