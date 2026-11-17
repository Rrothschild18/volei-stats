import { PlacarPage } from '../pages/placar.page';
import { expect, test } from '../fixtures';

/**
 * Lançar placar: o caminho que faz o app valer. No cenário há uma semifinal ao
 * vivo esperando número, e quem está usando o app (Caio) está nela.
 */
test.describe('lançar placar', () => {
  test('a gaveta abre com a partida de quem está em quadra', async ({ page, grupo }) => {
    await grupo.abrir('inicio');
    const placar = new PlacarPage(page);

    await placar.abrir();

    await expect(placar.gaveta).toContainText('PLACAR FINAL');
    await expect(placar.gaveta).toContainText('RAFA + MALU');
    await expect(placar.gaveta).toContainText('DUDA + CAIO');
  });

  test('0 × 0 não salva, e a folha não gasta frase para dizer isso', async ({ page, grupo }) => {
    await grupo.abrir('inicio');
    const placar = new PlacarPage(page);
    await placar.abrir();

    // 0 × 0 é como a folha abre, não um erro: o botão desligado já diz tudo.
    await expect(placar.botaoSalvar).toBeDisabled();
    await expect(placar.gaveta).not.toContainText('Ninguém jogou 0 × 0');
    await expect(placar.gaveta).not.toContainText('Limite:');
  });

  test('no lugar dos avisos, o histórico das duas duplas para arrastar', async ({
    page,
    grupo,
  }) => {
    await grupo.abrir('inicio');
    const placar = new PlacarPage(page);
    await placar.abrir();

    const slider = placar.gaveta.getByRole('region', { name: 'Histórico das duplas' });
    await expect(slider).toBeVisible();
    await expect(slider.getByRole('group')).toHaveCount(3);
    await expect(slider).toContainText('O confronto');

    // Arrastar não é o único caminho: a seta leva ao próximo cartão.
    await slider.getByRole('button', { name: 'Próximo cartão' }).click();
    await expect(slider.getByText('Cartão 2 de 3')).toBeAttached();
  });

  test('a bola segue o saque: pontuou quem sacava, fica; pontuou o outro, passa', async ({
    page,
    grupo,
  }) => {
    await grupo.abrir('inicio');
    const placar = new PlacarPage(page);
    await placar.abrir();

    // Sem ninguém marcado, cada dupla oferece o saque.
    await placar.gaveta.getByRole('button', { name: 'marcar o saque aqui' }).first().click();
    const bola = placar.gaveta.getByRole('button', { name: /^Saque com/ });
    await expect(bola).toHaveText(/SACA RAFA/);

    // Rafa saca e a dupla pontua: continua com ele.
    await placar.marcar('primeira', 2);
    await expect(bola).toHaveText(/SACA RAFA/);

    // A outra dupla pontua: a posse passa.
    await placar.marcar('segunda', 1);
    await expect(bola).toHaveText(/SACA DUDA/);

    // E quando a primeira recupera a posse, saca o OUTRO jogador dela.
    await placar.marcar('primeira', 1);
    await expect(bola).toHaveText(/SACA MALU/);

    // Tocar na bola corrige quem está sacando dentro da dupla.
    await bola.click();
    await expect(bola).toHaveText(/SACA RAFA/);
  });

  test('fechar a folha no meio do jogo não perde a contagem', async ({ page, grupo }) => {
    await grupo.abrir('inicio');
    const placar = new PlacarPage(page);
    await placar.abrir();

    await placar.marcar('primeira', 4);
    await placar.marcar('segunda', 3);
    await placar.botaoFechar.click();
    await expect(placar.gaveta).toHaveCount(0);

    await placar.abrir();
    await expect(placar.botaoSalvar).toHaveText(/SALVAR 4 × 3/);
  });

  test('empate não salva', async ({ page, grupo }) => {
    await grupo.abrir('inicio');
    const placar = new PlacarPage(page);
    await placar.abrir();

    await placar.marcar('primeira', 12);
    await placar.marcar('segunda', 12);

    await expect(placar.botaoSalvar).toBeDisabled();
  });

  test('terminar abaixo do limite de pontos pede confirmação', async ({ page, grupo }) => {
    await grupo.abrir('inicio');
    const placar = new PlacarPage(page);
    await placar.abrir();

    // Acabar antes do limite acontece (deu a hora, acabou a luz), mas é raro o
    // bastante para a tela perguntar em vez de salvar calado.
    await placar.marcar('primeira', 9);
    await placar.marcar('segunda', 5);
    await placar.botaoSalvar.click();

    await expect(page.getByRole('dialog', { name: 'Confirmar placar' })).toBeVisible();
  });

  test('o placar salvo trava a partida e registra quem lançou', async ({ page, grupo }) => {
    await grupo.abrir('inicio');
    const placar = new PlacarPage(page);
    await placar.abrir();

    // 12 é o limite deste campeonato, e com 5 do outro lado o jogo acaba aí:
    // 13 × 5 seria um jogo que não existiu (REGRAS.md §4.4).
    await placar.marcar('primeira', 12);
    await placar.marcar('segunda', 5);
    await expect(placar.botaoSalvar).toHaveText(/SALVAR 12 × 5/);
    await placar.botaoSalvar.click();

    await expect(placar.gaveta).toContainText('PLACAR SALVO');
    // Atenção ao que isto prova: que a tela MOSTRA quem lançou. Aqui o nome vem
    // do cenário em memória. Que o servidor é quem assina — e que o cliente não
    // consegue assinar por outro — é a metade `banco` que garante, em
    // `e2e/campeonato.spec.ts`, mais os testes de `supabase/tests/`.
    await expect(placar.gaveta).toContainText('TRAVADO · lançado por você');
    await expect(placar.gaveta).toContainText('12');

    // Fim de jogo é hora de ver a chave: o NO ZAP não mora mais aqui.
    await expect(placar.gaveta.getByRole('button', { name: /VER CHAVE/ })).toBeVisible();
    await expect(placar.gaveta.getByRole('button', { name: /NO ZAP/ })).toHaveCount(0);
  });

  test('salvo o placar, a chave anda para a fase seguinte', async ({ page, grupo }) => {
    await grupo.abrir('inicio');
    const placar = new PlacarPage(page);
    await placar.abrir();

    await placar.marcar('primeira', 12);
    await placar.marcar('segunda', 5);
    await placar.botaoSalvar.click();
    await expect(placar.gaveta).toContainText('PLACAR SALVO');
    await placar.botaoFechar.click();

    // Antes do placar a tela dizia "Semifinal (bye)"; agora é a semifinal.
    await expect(placar.gaveta).toHaveCount(0);
    await expect(page.locator('app-hero-field').first()).toContainText('Semifinal');
    await expect(page.locator('app-hero-field').first()).toContainText('RAFA + MALU');
  });
});
