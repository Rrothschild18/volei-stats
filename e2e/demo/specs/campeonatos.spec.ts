import { expect, test } from '../fixtures';

/**
 * Campeonatos: a sessão de hoje em cima, os campeonatos dela, e o histórico
 * embaixo. É o índice do que aconteceu no vôlei.
 */
test.describe('campeonatos', () => {
  test('mostra a sessão de hoje com os presentes', async ({ page, grupo }) => {
    await grupo.abrir('campeonatos');

    await expect(grupo.titulo).toHaveText('CAMPEONATOS');
    await expect(page.getByText('11 presentes')).toBeVisible();
    await expect(page.getByText('SESSÃO DE HOJE')).toBeVisible();
  });

  test('lista o campeonato ao vivo e o já decidido', async ({ page, grupo }) => {
    await grupo.abrir('campeonatos');

    await expect(page.getByText(/Ao vivo · Semifinal/)).toBeVisible();
    await expect(page.getByText(/Campeões · Rafa \+ Bia/)).toBeVisible();
  });

  test('o histórico traz as sessões anteriores', async ({ page, grupo }) => {
    await grupo.abrir('campeonatos');

    await expect(page.getByText('ANTERIORES')).toBeVisible();
    await expect(page.getByText(/8 presentes · 1 campeonato/).first()).toBeVisible();
  });

  test('tocar no campeonato ao vivo abre a chave dele', async ({ page, grupo }) => {
    await grupo.abrir('campeonatos');
    const aoVivo = page.getByRole('button').filter({ hasText: 'TIRA O PAR O ÍMPAR AÍ' }).first();
    await expect(aoVivo).toBeVisible();

    await aoVivo.click();

    await expect(page).toHaveURL(/\/campeonatos\/[^/]+$/);
  });
});
