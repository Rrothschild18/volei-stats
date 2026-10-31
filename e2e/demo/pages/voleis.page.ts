import { expect, Locator, Page } from '@playwright/test';

/** "Seus vôleis" (`/voleis`): um card por vôlei de que a pessoa participa. */
export class VoleisPage {
  constructor(private readonly page: Page) {}

  async abrir(): Promise<void> {
    await this.page.goto('/voleis');
    await expect(this.titulo).toBeVisible();
  }

  get titulo(): Locator {
    return this.page.getByRole('heading', { name: 'SEUS VÔLEIS' });
  }

  /**
   * O card de um vôlei. Os cards não têm nome acessível próprio (o nome do
   * vôlei mora num heading dentro deles), então o localizador é o card que
   * contém o nome — e não o botão, que diz só "você joga agora".
   */
  card(nomeDoVolei: string): Locator {
    return this.page
      .locator('app-hero-field, app-blueprint')
      .filter({ hasText: nomeDoVolei })
      .first();
  }

  /** O papel da pessoa naquele vôlei: DONO, JOGADOR ou VISITANTE. */
  papelNo(nomeDoVolei: string): Locator {
    return this.card(nomeDoVolei).locator('.tag').first();
  }

  /** Entra no vôlei e espera a tela de início dele. */
  async entrarNo(nomeDoVolei: string): Promise<void> {
    await this.card(nomeDoVolei).getByRole('button').first().click();
    await this.page.waitForURL(/\/g\/[^/]+\/inicio/);
  }
}
