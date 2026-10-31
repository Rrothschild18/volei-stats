import { VOLEI_SEGUNDA, VOLEI_TRABALHO } from '../pages/grupo.page';
import { expect, test } from '../fixtures';

/**
 * A lista de vôleis e o papel em cada um. No cenário a pessoa joga no Vôlei
 * Segunda e é dona do Vôlei Trabalho — é esse par que mostra a mesma tela
 * pelos dois papéis.
 */
test.describe('seus vôleis', () => {
  test('mostra os dois vôleis da pessoa, com o papel em cada um', async ({ voleis }) => {
    await voleis.abrir();

    await expect(voleis.card(VOLEI_SEGUNDA)).toBeVisible();
    await expect(voleis.card(VOLEI_TRABALHO)).toBeVisible();
    await expect(voleis.papelNo(VOLEI_SEGUNDA)).toHaveText('JOGADOR');
    await expect(voleis.papelNo(VOLEI_TRABALHO)).toHaveText('DONO');
  });

  test('o vôlei com sessão ao vivo hoje vem em destaque', async ({ voleis, page }) => {
    await voleis.abrir();

    // O app escreve em caixa alta pelo CSS, e o DOM guarda "Vôlei Segunda":
    // por isso as asserções de texto do cenário são sem caixa.
    const destaque = page.locator('app-hero-field');
    await expect(destaque).toContainText('HOJE · SESSÃO AO VIVO');
    await expect(destaque).toContainText(new RegExp(VOLEI_SEGUNDA, 'i'));
  });

  test('o papel de cada vôlei sobrevive a um recarregamento', async ({ voleis, page }) => {
    await voleis.abrir();
    await expect(voleis.papelNo(VOLEI_SEGUNDA)).toHaveText('JOGADOR');

    await page.reload();

    await expect(voleis.papelNo(VOLEI_SEGUNDA)).toHaveText('JOGADOR');
    await expect(voleis.papelNo(VOLEI_TRABALHO)).toHaveText('DONO');
  });
});
