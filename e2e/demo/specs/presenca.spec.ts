import { PresencaPage } from '../pages/presenca.page';
import { expect, test } from '../fixtures';

/**
 * Marcar presença é a primeira coisa que acontece num vôlei: sem ela não há
 * sorteio nem campeonato. No cenário, a sessão de hoje já está aberta com 11
 * presentes, então a tela entra em modo "editar presença".
 */
test.describe('presença', () => {
  test('a sessão de hoje abre com os 11 que apareceram', async ({ page, grupo }) => {
    await grupo.abrir('campeonatos/sessoes/nova');
    const presenca = new PresencaPage(page);

    await expect(grupo.titulo).toHaveText('EDITAR PRESENÇA');
    await expect(presenca.botaoSalvar).toContainText('11');
    await expect(presenca.jogador('Bia')).toHaveAttribute('aria-pressed', 'true');
    await expect(presenca.jogador('Dani')).toHaveAttribute('aria-pressed', 'false');
  });

  test('tirar alguém da presença muda a contagem', async ({ page, grupo }) => {
    await grupo.abrir('campeonatos/sessoes/nova');
    const presenca = new PresencaPage(page);
    await expect(presenca.botaoSalvar).toContainText('11');

    await presenca.jogador('Bia').click();

    await expect(presenca.jogador('Bia')).toHaveAttribute('aria-pressed', 'false');
    await expect(presenca.botaoSalvar).toContainText('10');
  });

  test('pôr alguém de volta conta outra vez', async ({ page, grupo }) => {
    await grupo.abrir('campeonatos/sessoes/nova');
    const presenca = new PresencaPage(page);
    await expect(presenca.botaoSalvar).toContainText('11');

    await presenca.jogador('Dani').click();

    await expect(presenca.jogador('Dani')).toHaveAttribute('aria-pressed', 'true');
    await expect(presenca.botaoSalvar).toContainText('12');
  });

  test('salvar a presença volta para a sessão do dia', async ({ page, grupo }) => {
    await grupo.abrir('campeonatos/sessoes/nova');
    const presenca = new PresencaPage(page);
    await expect(presenca.botaoSalvar).toContainText('11');

    await presenca.jogador('Dani').click();
    await expect(presenca.botaoSalvar).toContainText('12');
    await presenca.botaoSalvar.click();

    await expect(page).toHaveURL(/\/campeonatos\/sessoes\/[^/]+$/);
    await expect(page.locator('app-section-band').first()).toContainText(/presentes · 12/i);
    await expect(page.getByText(/dani/i).first()).toBeVisible();
  });
});
