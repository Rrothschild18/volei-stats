import { Locator, Page } from '@playwright/test';

/**
 * A folha de placar: a gaveta que abre em "LANÇAR PLACAR". É o caminho de
 * escrita mais importante do app — o que ela salva trava a partida e empurra a
 * chave para a fase seguinte.
 */
export class PlacarPage {
  constructor(private readonly page: Page) {}

  get gaveta(): Locator {
    return this.page.getByRole('dialog');
  }

  async abrir(): Promise<void> {
    await this.page.getByRole('button', { name: /LANÇAR PLACAR/ }).click();
    await this.gaveta.waitFor();
  }

  /** Sobe o placar de uma das duplas clique a clique, como quem conta ponto. */
  async marcar(dupla: 'primeira' | 'segunda', pontos: number): Promise<void> {
    const mais = this.page.getByRole('button', { name: `Aumentar pontos da ${dupla} dupla` });
    for (let i = 0; i < pontos; i++) {
      await mais.click();
    }
  }

  /** O rótulo do botão traz o placar: "SALVAR 13 × 5". */
  get botaoSalvar(): Locator {
    return this.page.getByRole('button', { name: /^SALVAR / });
  }

  get botaoFechar(): Locator {
    return this.gaveta.getByRole('button', { name: 'Fechar' });
  }
}
