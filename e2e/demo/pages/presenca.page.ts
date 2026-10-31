import { Locator, Page } from '@playwright/test';

/**
 * A presença do dia (`campeonatos/sessoes/nova`): quem apareceu. É a tela que
 * abre a sessão, e é dela que sai o sorteio.
 */
export class PresencaPage {
  constructor(private readonly page: Page) {}

  /** O botão de um jogador na lista de ativos. `aria-pressed` diz se está presente. */
  jogador(nome: string): Locator {
    return this.page
      .locator('app-section-band ~ * button, ul button')
      .filter({ hasText: new RegExp(`^${nome}`) })
      .last();
  }

  /** "SALVAR PRESENÇA · 11" ou "ABRIR SESSÃO · 8": o contador está no rótulo. */
  get botaoSalvar(): Locator {
    return this.page.getByRole('button', { name: /(SALVAR PRESENÇA|ABRIR SESSÃO) ·/ });
  }

  get contagem(): Locator {
    return this.page.getByText('PRESENTES');
  }

  get botaoLimpar(): Locator {
    return this.page.getByRole('button', { name: 'Limpar' });
  }
}
