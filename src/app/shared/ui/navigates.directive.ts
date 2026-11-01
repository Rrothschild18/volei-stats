import { Directive, DestroyRef, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, Router } from '@angular/router';

/** Abaixo disso, mostrar o anel seria um piscar e nada mais. */
const ATRASO_MS = 150;

/**
 * Depois disto o botão para de esperar por conta própria.
 *
 * É a rede de segurança: se o toque não levou a navegação nenhuma — a condição
 * não valia, o handler desistiu no meio —, o anel não pode ficar girando para
 * sempre num botão que já terminou o que tinha para fazer.
 */
const DESISTIR_MS = 4000;

/**
 * O botão que abre outra tela espera junto com ela.
 *
 * O anel de `appBusy` é para quem grava: a tela sabe que está esperando o banco
 * e diz. Mas boa parte dos botões do app não grava nada — "NOVA SESSÃO",
 * "NOVO SORTEIO", "CADASTRAR JOGADORES" só navegam. Eles pareciam instantâneos
 * e não são: a tela de destino tem código a baixar na primeira visita, guard a
 * resolver e dados a ler, e nesse tempo a tela ANTIGA continua inteira na
 * frente. Tocar e não acontecer nada é o que faz alguém tocar de novo.
 *
 * Por isso o estado vem do roteador e não da tela: quem sabe que a navegação
 * ainda não terminou é ele. E termina em qualquer um dos três fins — inclusive
 * `NavigationCancel`, que é como um guard que redireciona encerra.
 */
@Directive({
  selector: 'button[appNavigates]',
  host: {
    // Desabilitar é o que impede o toque duplo, e vale do PRIMEIRO instante:
    // esperar os 150 ms do anel deixaria uma janela em que dois toques passam.
    '[attr.disabled]': 'tocado() ? "" : null',
    '[attr.aria-busy]': 'abrindo() ? "true" : null',
    '(click)': 'aoTocar()',
  },
})
export class NavigatesDirective {
  /** Tocado: trava o botão. Vira falso quando a navegação termina. */
  protected readonly tocado = signal(false);
  /** Tocado há tempo suficiente para valer a pena mostrar o anel. */
  protected readonly abrindo = signal(false);

  #mostrar: ReturnType<typeof setTimeout> | undefined;
  #desistir: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const router = inject(Router);

    const assinatura = router.events.subscribe((evento) => {
      if (
        evento instanceof NavigationEnd ||
        evento instanceof NavigationCancel ||
        evento instanceof NavigationError
      ) {
        this.#parar();
      }
    });

    inject(DestroyRef).onDestroy(() => {
      this.#parar();
      assinatura.unsubscribe();
    });
  }

  protected aoTocar(): void {
    this.#parar();
    this.tocado.set(true);
    this.#mostrar = setTimeout(() => this.abrindo.set(true), ATRASO_MS);
    this.#desistir = setTimeout(() => this.#parar(), DESISTIR_MS);
  }

  #parar(): void {
    clearTimeout(this.#mostrar);
    clearTimeout(this.#desistir);
    this.abrindo.set(false);
    this.tocado.set(false);
  }
}
