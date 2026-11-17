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
    // O "≈" é o aviso de que é estimativa: a frase explicando saiu para dar
    // lugar ao botão de compartilhar.
    await expect(page.getByText(/≈ \d+ min/)).toBeVisible();
  });

  test('o NO ZAP transforma o resumo numa imagem', async ({ page, grupo }) => {
    await grupo.abrir('campeonatos/sessoes/s-hoje');

    const botao = page.getByRole('button', { name: 'Compartilhar o resumo da noite no WhatsApp' });
    await expect(botao).toBeVisible();

    // O navegador do teste não tem o compartilhar do celular: cai no caminho
    // de baixar, que é o do computador — e entrega um PNG de verdade.
    const [download] = await Promise.all([page.waitForEvent('download'), botao.click()]);
    expect(download.suggestedFilename()).toBe('resumo-da-noite.png');
    await expect(page.getByText(/A imagem foi baixada/)).toBeVisible();
  });

  test('a listagem de campeonatos também tem o NO ZAP do dia', async ({ page, grupo }) => {
    await grupo.abrir('campeonatos');

    await expect(
      page.getByRole('button', { name: 'Compartilhar o resumo da noite no WhatsApp' }),
    ).toBeVisible();
  });

  test('a home traz as três faixas: mural, a última noite e os recordes', async ({
    page,
    grupo,
  }) => {
    await grupo.abrir('inicio');

    await expect(page.getByText('MURAL')).toBeVisible();
    await expect(page.getByText('mais vitórias').first()).toBeVisible();
    await expect(page.getByText(/dupla do coração · desde sempre/)).toBeVisible();
    await expect(page.getByText(/A ÚLTIMA NOITE/)).toBeVisible();
    await expect(page.getByText('RECORDES DO GRUPO')).toBeVisible();
    await expect(page.getByText('maior sequência da história')).toBeVisible();

    // O mural é para parabenizar: nada de aproveitamento na home.
    await expect(page.getByText(/aproveitamento/i)).toHaveCount(0);
  });
});
