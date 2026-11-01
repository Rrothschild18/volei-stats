import { expect, test } from '../fixtures';
import { ID_VOLEI_SEGUNDA } from '../pages/grupo.page';
import { PlacarPage } from '../pages/placar.page';
import { PresencaPage } from '../pages/presenca.page';
import type { Page } from '../fixtures';

/** O campeonato ao vivo do cenário: rodada 1 fechada, encaixe já decidido. */
const AO_VIVO = `/g/${ID_VOLEI_SEGUNDA}/campeonatos/tn-camp-2`;
/** Tira o sorteio do próximo campeonato a partir da tela ao vivo. */
async function sortearOProximo(page: Page): Promise<void> {
  await page.goto(AO_VIVO);
  await page.getByRole('button', { name: /JÁ DÁ PARA SORTEAR O PRÓXIMO/ }).click();
  await page.getByRole('button', { name: /USAR PROPOSTA/ }).click();
  await expect(page).toHaveURL(/\/campeonatos\/tn-camp-2$/);
}

/**
 * Sortear o próximo durante a final (tickets 36 e 37).
 *
 * No cenário, o campeonato 2 está na semifinal: a rodada 1 fechou e o
 * par-ou-ímpar do encaixe já foi aplicado. Daí em diante nada do que acontece
 * nele muda o sorteio seguinte — então o convite aparece.
 */
test.describe('sortear o próximo', () => {
  test('o convite aparece na tela do campeonato ao vivo', async ({ page }) => {
    await page.goto(AO_VIVO);

    const convite = page.getByRole('button', { name: /JÁ DÁ PARA SORTEAR O PRÓXIMO/ });
    await expect(convite).toBeVisible();

    // Alvo de toque de 44 px (WCAG 2.5.5).
    const alvo = await convite.boundingBox();
    expect(alvo?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test('não rouba o foco ao aparecer', async ({ page }) => {
    await page.goto(AO_VIVO);
    await expect(page.getByRole('button', { name: /JÁ DÁ PARA SORTEAR/ })).toBeVisible();

    // Ele aparece no meio de outra tarefa: o foco fica onde estava.
    await expect(page.locator('body')).toBeFocused();
  });

  test('é anunciado por uma região polite', async ({ page }) => {
    await page.goto(AO_VIVO);

    const regiao = page.locator('app-floating-invite [aria-live="polite"]');
    await expect(regiao).toHaveAttribute('aria-live', 'polite');
    await expect(regiao).toContainText('JÁ DÁ PARA SORTEAR O PRÓXIMO');
  });

  test('não cobre a última linha da lista: o conteúdo reserva o respiro', async ({ page }) => {
    await page.goto(AO_VIVO);
    const convite = page.getByRole('button', { name: /JÁ DÁ PARA SORTEAR O PRÓXIMO/ });
    await expect(convite).toBeVisible();

    await page.mouse.wheel(0, 4000);
    const ultima = page.locator('app-blueprint').last();
    await expect(ultima).toBeVisible();

    const fim = await ultima.boundingBox();
    const flutuante = await convite.boundingBox();
    expect(fim!.y + fim!.height).toBeLessThanOrEqual(flutuante!.y);
  });

  test('descartado, não volta neste campeonato', async ({ page }) => {
    await page.goto(AO_VIVO);
    await page.getByRole('button', { name: 'Descartar o convite de sortear o próximo' }).click();

    await expect(page.getByRole('button', { name: /JÁ DÁ PARA SORTEAR/ })).toBeHidden();

    await page.reload();
    await expect(page.getByRole('button', { name: /JÁ DÁ PARA SORTEAR/ })).toBeHidden();
  });

  test('sortear volta para o campeonato, e o convite passa a dizer que já está sorteado', async ({
    page,
  }) => {
    await page.goto(AO_VIVO);
    await page.getByRole('button', { name: /JÁ DÁ PARA SORTEAR O PRÓXIMO/ }).click();

    // O sorteio de sempre — e as prioridades saem do campeonato que está rolando.
    await expect(page).toHaveURL(/\/sorteio\?voltarPara=tn-camp-2$/);
    await expect(page.getByText('PRIORIDADES')).toBeVisible();

    await page.getByRole('button', { name: /USAR PROPOSTA/ }).click();

    // A final ainda precisa de placar: volta para o ao vivo, não para o formato.
    await expect(page).toHaveURL(/\/campeonatos\/tn-camp-2$/);
    await expect(page.getByRole('button', { name: /O PRÓXIMO JÁ ESTÁ SORTEADO/ })).toBeVisible();
  });
});

test.describe('a condição deixa de valer', () => {
  test('correção que reabre um desempate faz o convite sumir e invalida o sorteio', async ({
    page,
  }) => {
    await sortearOProximo(page);
    await expect(page.getByRole('button', { name: /O PRÓXIMO JÁ ESTÁ SORTEADO/ })).toBeVisible();

    // A rodada 1 tinha 12 × 7 e 10 × 12: diferenças de 5 e 2. Com 12 × 10 as
    // duas passam a 2, e aí nenhum critério diz quem está fora — a chave
    // pausa e espera um par-ou-ímpar na quadra.
    await page.getByRole('button', { name: 'Corrigir' }).first().click();
    const placar = new PlacarPage(page);
    await expect(placar.gaveta).toContainText('CORRIGIR PLACAR');
    await placar.marcar('segunda', 3);
    await page.getByRole('button', { name: /^CORRIGIR 12 × 10/ }).click();

    // A chave pausa na hora: o desempate reaberto pede par-ou-ímpar na quadra.
    await expect(page.getByRole('dialog')).toContainText('EMPATE NA DIFERENÇA');

    // A condição do ticket 36 caiu: nada de convite, e o sorteio que já havia
    // saído dela não vale mais.
    await expect(page.getByRole('button', { name: /SORTEAR O PRÓXIMO/ })).toBeHidden();
    await expect(page.getByRole('button', { name: /O PRÓXIMO JÁ ESTÁ SORTEADO/ })).toBeHidden();

    await page.goto(`/g/${ID_VOLEI_SEGUNDA}/campeonatos/tn-camp-1/classificacao`);
    await expect(page.getByText('O PRÓXIMO JÁ ESTÁ SORTEADO')).toBeHidden();
  });
});

/** A classificação deste campeonato, onde o próximo é oferecido. */
const CLASSIFICACAO = `/g/${ID_VOLEI_SEGUNDA}/campeonatos/tn-camp-2/classificacao`;

/**
 * Lança o que falta até o campeonato encerrar: é a final que estava sendo
 * jogada enquanto o próximo era sorteado.
 */
async function lancarAteOFim(page: Page): Promise<void> {
  const placar = new PlacarPage(page);
  const lancar = page.getByRole('button', { name: /LANÇAR PLACAR/ });

  for (let tentativa = 0; tentativa < 8; tentativa++) {
    await placar.abrir();
    await placar.marcar('primeira', 12);
    await placar.marcar('segunda', 6);
    await placar.botaoSalvar.click();
    await expect(placar.gaveta).toContainText('PLACAR SALVO');
    await placar.botaoFechar.click();

    // Fechar a gaveta ou encerra o campeonato — e a classificação abre — ou
    // devolve a próxima partida. Esperar pelos dois evita a corrida.
    await Promise.race([
      page.waitForURL(/\/classificacao$/).catch(() => undefined),
      lancar.waitFor({ state: 'visible' }).catch(() => undefined),
    ]);

    if (page.url().includes('classificacao')) {
      return;
    }
  }

  await expect(page).toHaveURL(/\/classificacao$/);
}

test.describe('o próximo já sorteado, na classificação', () => {
  test('sorteado durante a final, o próximo espera na classificação', async ({ page }) => {
    await sortearOProximo(page);

    await lancarAteOFim(page);

    await expect(page.getByText('O PRÓXIMO JÁ ESTÁ SORTEADO')).toBeVisible();
    await expect(page.getByRole('button', { name: /COMEÇAR O PRÓXIMO/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /NOVO SORTEIO/ })).toBeHidden();
  });

  test('começar leva à tela de formato daquele sorteio', async ({ page }) => {
    await sortearOProximo(page);
    await lancarAteOFim(page);

    await page.getByRole('button', { name: /COMEÇAR O PRÓXIMO/ }).click();

    await expect(page).toHaveURL(/\/campeonatos\/novo\?drawId=/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('FORMATO');
  });

  test('descartar o sorteio devolve o botão de sortear', async ({ page }) => {
    await sortearOProximo(page);
    await lancarAteOFim(page);

    await page.getByRole('button', { name: 'Descartar este sorteio' }).click();

    await expect(page.getByText('O PRÓXIMO JÁ ESTÁ SORTEADO')).toBeHidden();
    await expect(page.getByRole('button', { name: /NOVO SORTEIO/ })).toBeVisible();
  });

  test('presença diferente da do sorteio é apontada, e não dá para começar', async ({ page }) => {
    await sortearOProximo(page);
    await lancarAteOFim(page);

    // Alguém foi embora depois do sorteio adiantado.
    await page.goto(`/g/${ID_VOLEI_SEGUNDA}/campeonatos/sessoes/nova`);
    const presenca = new PresencaPage(page);
    await presenca.jogador('Bia').click();
    await presenca.botaoSalvar.click();

    await page.goto(CLASSIFICACAO);

    await expect(page.getByText(/Bia está no sorteio e não está mais aqui/)).toBeVisible();
    await expect(page.getByRole('button', { name: /NOVO SORTEIO/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /COMEÇAR O PRÓXIMO/ })).toBeHidden();
  });
});
