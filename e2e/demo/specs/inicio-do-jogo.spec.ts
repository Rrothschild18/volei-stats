import { PlacarPage } from '../pages/placar.page';
import { expect, test } from '../fixtures';

/**
 * O início do jogo (ticket 07): par-ou-ímpar, lado da quadra e saque inicial.
 *
 * O que importa testar é o contrato social do passo — ele **não pode atrasar o
 * placar** — e a derivação do sacador, que é a única coisa que o app afirma
 * sozinho em quadra.
 */
test.describe('início do jogo', () => {
  test('o placar salva sem ninguém registrar o início', async ({ page, grupo }) => {
    await grupo.abrir('inicio');
    const placar = new PlacarPage(page);
    await placar.abrir();

    await expect(page.getByText('Início do jogo')).toBeVisible();
    await expect(
      page.getByText('Ninguém precisa registrar isso para lançar o placar.'),
    ).toBeVisible();

    await placar.marcar('primeira', 12);
    await placar.marcar('segunda', 5);
    await placar.botaoSalvar.click();

    await expect(page.getByText('PLACAR SALVO')).toBeVisible();
    await expect(page.getByText(/Par-ou-ímpar:/)).toBeHidden();
  });

  test('quem escolhe saque abre sacando; quem escolhe lado entrega o saque', async ({
    page,
    grupo,
  }) => {
    await grupo.abrir('inicio');
    const placar = new PlacarPage(page);
    await placar.abrir();

    const duplaA = placar.gaveta.getByRole('button', { name: 'RAFA + MALU' });
    await duplaA.click();
    await page.getByRole('button', { name: 'Lado', exact: true }).click();

    // Escolheu lado: quem saca é a OUTRA dupla.
    await expect(page.getByText('Abre sacando: DUDA + CAIO')).toBeVisible();

    await page.getByRole('button', { name: 'Saque', exact: true }).click();
    await expect(page.getByText('Abre sacando: RAFA + MALU')).toBeVisible();
  });

  test('o que foi registrado aparece no placar travado', async ({ page, grupo }) => {
    await grupo.abrir('inicio');
    const placar = new PlacarPage(page);
    await placar.abrir();

    await placar.gaveta.getByRole('button', { name: 'RAFA + MALU' }).click();
    await page.getByRole('button', { name: 'Saque', exact: true }).click();
    await page.getByRole('button', { name: 'Esquerda' }).click();

    await placar.marcar('primeira', 12);
    await placar.marcar('segunda', 7);
    await placar.botaoSalvar.click();

    await expect(page.getByText(/Par-ou-ímpar: RAFA \+ MALU/)).toBeVisible();
    await expect(page.getByText(/abriu sacando RAFA \+ MALU/)).toBeVisible();
    await expect(page.getByText(/à esquerda/)).toBeVisible();
  });
});
