import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/**
 * Como a tela se mantém fresca sem conexão viva.
 *
 * O app não mantém conexão aberta de propósito (docs/PLANO-SUPABASE.md §3):
 * ninguém fica olhando o celular durante o jogo, e o que se lança é o placar
 * final de umas cinco partidas por noite. Então a tela relê em três momentos,
 * que cobrem o que de fato acontece na quadra:
 *
 *   * ao voltar para o app — o celular ficou no bolso enquanto o jogo rolava;
 *   * quando a rede volta — estava sem sinal e o pedido falhou;
 *   * quando a pessoa puxa para atualizar — ela quer agora.
 *
 * Depois de cada escrita, quem relê é a própria tela que escreveu: ela sabe o
 * que mudou, e releria mesmo sem isto aqui.
 */
@Injectable({ providedIn: 'root' })
export class RefreshService {
  private readonly reloaders = new Set<() => Promise<void>>();

  /** Verdadeiro enquanto uma releitura está em voo: segura o indicador. */
  readonly refreshing = signal(false);

  constructor() {
    // Um par de ouvintes para o app todo, e não um por tela: assim duas telas
    // montadas ao mesmo tempo não disparam duas releituras cada.
    document.addEventListener('visibilitychange', this.onVisible);
    window.addEventListener('online', this.onOnline);
  }

  /**
   * A tela diz como se relê. O registro sai sozinho quando ela é destruída —
   * sem isso, voltar para o app releria telas que já não existem.
   */
  register(reload: () => Promise<void>): void {
    this.reloaders.add(reload);
    inject(DestroyRef).onDestroy(() => this.reloaders.delete(reload));
  }

  async refresh(): Promise<void> {
    if (this.refreshing()) {
      return;
    }
    this.refreshing.set(true);
    try {
      // `allSettled`: uma tela que falha não impede a outra de se atualizar.
      await Promise.allSettled([...this.reloaders].map((reload) => reload()));
    } finally {
      this.refreshing.set(false);
    }
  }

  private readonly onVisible = (): void => {
    if (document.visibilityState === 'visible') {
      void this.refresh();
    }
  };

  private readonly onOnline = (): void => {
    void this.refresh();
  };
}
