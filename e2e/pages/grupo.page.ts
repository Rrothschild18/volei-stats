import { expect, Locator, Page } from '@playwright/test';

/** As quatro abas do vôlei, na ordem da barra de baixo. */
export const ABAS = ['Início', 'Campeonatos', 'Rankings', 'Jogadores'] as const;
export type Aba = (typeof ABAS)[number];

/** O vôlei do cenário em que acontece quase tudo. */
export const VOLEI_SEGUNDA = 'VÔLEI SEGUNDA';
export const ID_VOLEI_SEGUNDA = 'g-segunda';

/** Dentro de um vôlei (`/g/:groupId/...`): header, abas e títulos de tela. */
export class GrupoPage {
  constructor(private readonly page: Page) {}

  /** Vai direto a uma tela do vôlei, sem passar pela lista. */
  async abrir(aba: string, groupId = ID_VOLEI_SEGUNDA): Promise<void> {
    await this.page.goto(`/g/${groupId}/${aba}`);
  }

  aba(nome: Aba): Locator {
    return this.page.getByRole('link', { name: nome });
  }

  /** O título grande da tela: JOGADORES, RANKINGS, CAMPEONATOS… */
  get titulo(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }

  /** A tag ao lado do header: DONO quando a pessoa é dona do vôlei. */
  get papel(): Locator {
    return this.page.locator('app-role-tag');
  }

  async irPara(nome: Aba): Promise<void> {
    await this.aba(nome).click();
    await expect(this.aba(nome)).toHaveAttribute('aria-current', 'page');
  }
}
