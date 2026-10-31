import { Locator, Page } from '@playwright/test';

/** A aba Jogadores: busca, filtro de ativos e a lista. */
export class JogadoresPage {
  constructor(private readonly page: Page) {}

  get busca(): Locator {
    return this.page.getByRole('searchbox', { name: 'Buscar jogador' });
  }

  get lista(): Locator {
    return this.page.getByRole('listitem');
  }

  filtro(nome: 'Ativos' | 'Inativos' | 'Todos'): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^${nome}`, 'i') });
  }

  linha(nomeDoJogador: string): Locator {
    return this.page.getByRole('listitem').filter({ hasText: nomeDoJogador });
  }

  /** Os botões de dono, que não renderizam para quem só joga. */
  get botaoNovoJogador(): Locator {
    return this.page.getByRole('button', { name: /NOVO JOGADOR/i });
  }

  get botaoConvite(): Locator {
    return this.page.getByRole('button', { name: /^CONVITE/i });
  }
}
