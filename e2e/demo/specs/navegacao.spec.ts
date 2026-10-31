import { ABAS, ID_VOLEI_SEGUNDA, VOLEI_SEGUNDA } from '../pages/grupo.page';
import { expect, test } from '../fixtures';

/**
 * O caminho que todo mundo faz: abrir o app, escolher o vôlei, andar pelas
 * abas. Se este arquivo passar, o app sobe e as rotas respondem.
 */
test.describe('navegação', () => {
  test('a raiz leva à lista de vôleis', async ({ page, voleis }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/voleis$/);
    await expect(voleis.titulo).toBeVisible();
  });

  test('rota que não existe volta para a lista de vôleis', async ({ page, voleis }) => {
    await page.goto('/isso-nao-existe');
    await expect(page).toHaveURL(/\/voleis$/);
    await expect(voleis.titulo).toBeVisible();
  });

  test('da lista entra-se no vôlei, e a tela é o início dele', async ({ voleis, grupo }) => {
    await voleis.abrir();
    await voleis.entrarNo(VOLEI_SEGUNDA);

    await expect(grupo.aba('Início')).toHaveAttribute('aria-current', 'page');
    await expect(grupo.papel).toContainText('Caio');
  });

  test('as quatro abas levam cada uma à sua tela', async ({ voleis, grupo, page }) => {
    await voleis.abrir();
    await voleis.entrarNo(VOLEI_SEGUNDA);

    const titulos: Record<string, RegExp> = {
      Início: /\/inicio$/,
      Campeonatos: /\/campeonatos$/,
      Rankings: /\/rankings$/,
      Jogadores: /\/jogadores$/,
    };

    for (const aba of ABAS) {
      await grupo.irPara(aba);
      await expect(page).toHaveURL(titulos[aba]);
    }
  });

  test('o link de uma tela interna abre direto nela', async ({ grupo, page }) => {
    await grupo.abrir('rankings');

    await expect(grupo.titulo).toHaveText('RANKINGS');
    await expect(page).toHaveURL(new RegExp(`/g/${ID_VOLEI_SEGUNDA}/rankings$`));
  });
});
