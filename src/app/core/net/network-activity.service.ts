import { Service, computed, signal } from '@angular/core';

/**
 * Quantos pedidos ao banco estão em voo agora.
 *
 * O banco está nos Estados Unidos e o vôlei é no Brasil: uma leitura leva
 * alguns segundos, e sem sinal na tela o toque parece não ter acontecido.
 * Contar aqui — e não em cada tela — é o que faz o aviso valer para TODO
 * pedido, inclusive os que nenhum botão disparou: abrir a tela, renovar o
 * token.
 *
 * É contador, e não um booleano: dois pedidos em paralelo terminam em
 * instantes diferentes, e o primeiro a voltar não pode apagar a espera do
 * outro.
 */
@Service()
export class NetworkActivityService {
  readonly #inFlight = signal(0);

  readonly active = computed(() => this.#inFlight() > 0);

  /** Envolve um pedido: entra na conta antes, sai depois — deu certo ou não. */
  async track<T>(request: () => Promise<T>): Promise<T> {
    this.#inFlight.update((count) => count + 1);
    try {
      return await request();
    } finally {
      this.#inFlight.update((count) => count - 1);
    }
  }
}
