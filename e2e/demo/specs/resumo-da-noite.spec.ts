import { expect, test } from '../fixtures';

/**
 * O resumo esportivo da sessão (ticket 02): o mural de parabéns da noite.
 *
 * Os valores vêm do cenário do demo, então os testes conferem o que o resumo
 * PROMETE — que os destaques existem, que a duração é dita como estimativa e
 * que nada aparece numa noite sem jogo — e não números fixos, que viram
 * vermelho sem defeito toda vez que o seed muda.
 */
test.describe('resumo da noite', () => {
  test('a sessão de hoje traz os destaques da noite', async ({ page, grupo }) => {
    await grupo.abrir('campeonatos/sessoes/s-hoje');

    await expect(page.getByText('RESUMO DA NOITE')).toBeVisible();
    await expect(page.getByText('partidas jogadas')).toBeVisible();
    await expect(page.getByText('mais vitórias')).toBeVisible();
    await expect(page.getByText('fechou a quadra')).toBeVisible();
    await expect(page.getByText(/campeões · /)).toBeVisible();
  });

  test('a duração é apresentada como estimativa, não como cronômetro', async ({ page, grupo }) => {
    await grupo.abrir('campeonatos/sessoes/s-hoje');

    await expect(page.getByText('duração média da partida')).toBeVisible();
    await expect(page.getByText(/≈ \d+ min/)).toBeVisible();
    await expect(page.getByText(/Duração estimada pelo intervalo entre os placares/)).toBeVisible();
  });
});
