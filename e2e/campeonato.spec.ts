import { expect, test } from '@playwright/test';
import { ajustarPlacar, cadastrar, criarVolei, limparVoleisDeTeste, nomeDeVolei } from './apoio';

test.afterAll(limparVoleisDeTeste);

/**
 * Uma noite de vôlei inteira, do nada ao campeonato encerrado.
 *
 * É o caminho mais longo do app, e o que atravessa mais tabelas: presença,
 * sorteio com as três propostas, chaveamento, placar e classificação. Quatro
 * pessoas é o mínimo que dá campeonato — e com quatro o formato é final direta,
 * uma partida só, o que mantém o teste curto.
 */
test('um campeonato do zero até o fim', async ({ page }) => {
  const { groupId } = await criarVolei(page, nomeDeVolei('campeonato'), 'Raul');
  for (const nome of ['Be', 'Caio', 'Vitória']) {
    await cadastrar(page, groupId, nome);
  }

  // ===== presença =====
  await page.goto(`/g/${groupId}/inicio`);
  await page.getByRole('button', { name: /NOVA SESSÃO/ }).click();
  await expect(page).toHaveURL(/\/campeonatos\/sessoes\/nova$/);

  const nomes = page.locator('button[aria-pressed]');
  await expect(nomes).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    await nomes.nth(i).click();
  }
  // O contador fica em dois elementos ("4" e "presentes"), então o sinal de que
  // deu é a frase que aparece quando há gente bastante.
  await expect(page.getByText('Dá para jogar: Final direta')).toBeVisible();
  await page.getByRole('button', { name: /ABRIR SESSÃO/ }).click();
  await expect(page).toHaveURL(/\/campeonatos\/sessoes\/[0-9a-f-]+$/);
  await expect(page.getByText('01 · PRESENTES · 4')).toBeVisible();

  // ===== sorteio =====
  await page.getByRole('button', { name: /NOVO SORTEIO/ }).click();
  await expect(page).toHaveURL(/\/sorteio$/);
  // Três propostas, sempre: é por elas que o grupo escolhe em vez de aceitar.
  await expect(page.getByText('3 distintas')).toBeVisible();
  await page.getByRole('button', { name: /USAR PROPOSTA/ }).click();

  // ===== campeonato =====
  await expect(page).toHaveURL(/\/campeonatos\/novo\?/);
  await expect(page.getByText('FINAL DIRETA')).toBeVisible();
  await page.getByRole('button', { name: /INICIAR CAMPEONATO/ }).click();
  await expect(page).toHaveURL(/\/campeonatos\/[0-9a-f-]+$/);
  await expect(page.getByText('CAMPEONATO · AO VIVO')).toBeVisible();
  const campeonato = new URL(page.url()).pathname;

  // ===== placar =====
  await page
    .getByRole('button', { name: /LANÇAR PLACAR/ })
    .first()
    .click();
  await ajustarPlacar(page, 12, 9);
  // Chegou ao limite de pontos: salva direto, sem perguntar.
  await page.getByRole('button', { name: /SALVAR 12 × 9/ }).click();

  // O campeonato acabou com a única partida dele.
  await expect(page.getByText('CAMPEONATO · FINALIZADO')).toBeVisible();
  await expect(page.getByText('TRAVADO · lançado por você')).toBeVisible();

  // ===== corrigir, depois de o campeonato ter acabado =====
  // Um campeonato encerrado abre na classificação, e é de lá que se chega às
  // partidas. Sem esse caminho, um placar errado ficava errado para sempre.
  await page.goto(`${campeonato}/classificacao`);
  await page.getByRole('button', { name: /Errou um placar/ }).click();
  await expect(page).toHaveURL(/partidas=1$/);
  await page
    .getByRole('button', { name: /Corrigir/ })
    .first()
    .click();

  // Empate recusado e a pergunta do placar abaixo do limite são regras de tela,
  // e têm teste na metade `demo`, que é mais rápida. Aqui interessa o que só o
  // banco prova: a assinatura de quem corrigiu é gravada por GATILHO, a partir
  // de quem pediu — e é ela que torna aceitável deixar qualquer jogador
  // corrigir. Como coluna comum, bastava não mandá-la.
  // 12 × 14: o jogo empatou em 12 e foi até a segunda dupla abrir dois. Com
  // limite 12, 12 × 13 seria um jogo que não acabou (REGRAS.md §4.4).
  await ajustarPlacar(page, 0, 5);
  await page.getByRole('button', { name: /CORRIGIR 12 × 14/ }).click();
  await expect(page.getByText('Corrigido por Raul')).toBeVisible();

  // ===== o ranking somou =====
  await page.goto(`/g/${groupId}/rankings`);
  await expect(page.getByText('Ranking individual do grupo')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(4);
});
