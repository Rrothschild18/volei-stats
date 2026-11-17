import { Page } from '@playwright/test';
import { expect, test } from '../fixtures';

/**
 * Estatísticas: as três visões do mesmo histórico. É a tela que dá sentido a
 * ter lançado placar — e a que mais depende de o cálculo chegar na tela.
 *
 * A ordem é por VITÓRIAS, não por aproveitamento: é a régua do mural (ticket
 * 05). Os testes conferem a ordem lendo a coluna, e não um nome fixo, porque
 * quem lidera depende do seed e um nome fixo transforma mudança de seed em
 * teste vermelho sem defeito nenhum.
 */
test.describe('estatísticas', () => {
  /** Uma coluna do corpo da tabela, de cima para baixo. */
  async function coluna(page: Page, indice: number): Promise<number[]> {
    const linhas = await page.locator('tbody tr').all();
    const valores: number[] = [];
    for (const linha of linhas) {
      const texto = await linha.locator('td').nth(indice).textContent();
      valores.push(Number((texto ?? '').trim()));
    }
    return valores;
  }

  test('abre no individual, ordenado por vitórias', async ({ page, grupo }) => {
    await grupo.abrir('estatisticas');

    await expect(grupo.titulo).toHaveText('ESTATÍSTICAS');
    await expect(page.getByRole('tab', { name: 'Individual' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText(/Ordem por vitórias/)).toBeVisible();

    const vitorias = await coluna(page, 3);
    expect(vitorias.length).toBeGreaterThan(1);
    expect(vitorias).toEqual([...vitorias].sort((a, b) => b - a));
  });

  test('a aba Duplas ordena as duplas por vitórias', async ({ page, grupo }) => {
    await grupo.abrir('estatisticas');
    await expect(page.getByRole('tab', { name: 'Individual' })).toBeVisible();

    await page.getByRole('tab', { name: 'Duplas' }).click();

    await expect(page.getByRole('tab', { name: 'Duplas' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const vitorias = await coluna(page, 3);
    expect(vitorias.length).toBeGreaterThan(1);
    expect(vitorias).toEqual([...vitorias].sort((a, b) => b - a));
  });

  test('a aba Partidas lista o histórico de jogos', async ({ page, grupo }) => {
    await grupo.abrir('estatisticas');
    await expect(page.getByRole('tab', { name: 'Individual' })).toBeVisible();

    await page.getByRole('tab', { name: 'Partidas' }).click();

    await expect(page.getByRole('tab', { name: 'Partidas' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('app-section-band').first()).toBeVisible();
  });

  test('o link antigo /rankings continua abrindo a tela', async ({ page, grupo }) => {
    await grupo.abrir('rankings');

    await expect(grupo.titulo).toHaveText('ESTATÍSTICAS');
    await expect(page).toHaveURL(/\/estatisticas$/);
  });
});
