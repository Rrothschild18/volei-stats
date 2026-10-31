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

  test('0 × 0 não salva: o app diz que ninguém jogou isso', async ({ page, grupo }) => {
    await grupo.abrir('inicio');
    const placar = new PlacarPage(page);
    await placar.abrir();

    await expect(placar.gaveta).toContainText('Ninguém jogou 0 × 0');
    await expect(placar.botaoSalvar).toBeDisabled();
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

    await placar.marcar('primeira', 13);
    await placar.marcar('segunda', 5);
    await expect(placar.botaoSalvar).toHaveText(/SALVAR 13 × 5/);
    await placar.botaoSalvar.click();

    await expect(placar.gaveta).toContainText('PLACAR SALVO');
    // Atenção ao que isto prova: que a tela MOSTRA quem lançou. Aqui o nome vem
    // do cenário em memória. Que o servidor é quem assina — e que o cliente não
    // consegue assinar por outro — é a metade `banco` que garante, em
    // `e2e/campeonato.spec.ts`, mais os testes de `supabase/tests/`.
    await expect(placar.gaveta).toContainText('TRAVADO · lançado por você');
    await expect(placar.gaveta).toContainText('13');
  });

  test('salvo o placar, a chave anda para a fase seguinte', async ({ page, grupo }) => {
    await grupo.abrir('inicio');
    const placar = new PlacarPage(page);
    await placar.abrir();

    await placar.marcar('primeira', 13);
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
