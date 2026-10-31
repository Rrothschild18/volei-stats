import { expect, test } from '../fixtures';

/**
 * Rankings: as três visões do mesmo histórico. É a tela que dá sentido a ter
 * lançado placar — e a que mais depende de o cálculo chegar na tela.
 */
test.describe('rankings', () => {
  test('abre no ranking individual, ordenado por aproveitamento', async ({ page, grupo }) => {
    await grupo.abrir('rankings');

    await expect(grupo.titulo).toHaveText('RANKINGS');
    await expect(page.getByRole('tab', { name: 'Individual' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // Caixa alta é CSS: o DOM diz "Bia". Daí o `/i`.
    const primeira = page.getByRole('row').nth(1);
    await expect(primeira).toContainText(/bia/i);
    await expect(primeira).toContainText('64');
  });

  test('a aba Duplas mostra o ranking de duplas', async ({ page, grupo }) => {
    await grupo.abrir('rankings');
    await expect(page.getByRole('tab', { name: 'Individual' })).toBeVisible();

    await page.getByRole('tab', { name: 'Duplas' }).click();

    await expect(page.getByRole('tab', { name: 'Duplas' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('row').nth(1)).toContainText(/rafa \+ bia/i);
  });

  test('a aba Partidas lista o histórico de jogos', async ({ page, grupo }) => {
    await grupo.abrir('rankings');
    await expect(page.getByRole('tab', { name: 'Individual' })).toBeVisible();

    await page.getByRole('tab', { name: 'Partidas' }).click();

    await expect(page.getByRole('tab', { name: 'Partidas' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('app-section-band').first()).toBeVisible();
  });
});
