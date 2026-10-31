import { JogadoresPage } from '../pages/jogadores.page';
import { expect, test } from '../fixtures';

/**
 * Jogadores: buscar, filtrar, abrir a ficha — e as ações que só o dono vê.
 */
test.describe('jogadores', () => {
  test('lista quem está no vôlei, com jogos e aproveitamento', async ({ page, grupo }) => {
    await grupo.abrir('jogadores');
    const jogadores = new JogadoresPage(page);

    await expect(grupo.titulo).toHaveText('JOGADORES');
    await expect(jogadores.linha('BIA')).toContainText('28 J · 64%');
  });

  test('a busca filtra a lista pelo nome', async ({ page, grupo }) => {
    await grupo.abrir('jogadores');
    const jogadores = new JogadoresPage(page);
    await expect(jogadores.linha('BIA')).toBeVisible();

    await jogadores.busca.fill('thi');

    await expect(jogadores.lista).toHaveCount(1);
    await expect(jogadores.linha('THIAGO')).toBeVisible();
  });

  test('a busca sem resultado diz que não achou ninguém', async ({ page, grupo }) => {
    await grupo.abrir('jogadores');
    const jogadores = new JogadoresPage(page);

    await jogadores.busca.fill('zzz');

    await expect(page.getByText('Ninguém encontrado com esse nome.')).toBeVisible();
  });

  test('o filtro mostra os inativos, que não entram na presença', async ({ page, grupo }) => {
    await grupo.abrir('jogadores');
    const jogadores = new JogadoresPage(page);
    await expect(jogadores.linha('BIA')).toBeVisible();

    await jogadores.filtro('Inativos').click();

    await expect(jogadores.lista).toHaveCount(2);
    await expect(jogadores.lista.first()).toContainText('Inativo · fora da lista de presença');
  });

  test('tocar num jogador abre a ficha dele', async ({ page, grupo }) => {
    await grupo.abrir('jogadores');
    const jogadores = new JogadoresPage(page);

    await jogadores.linha('BIA').getByRole('button').click();

    await expect(page).toHaveURL(/\/jogadores\/p-bia$/);
    await expect(page.getByRole('heading', { name: 'BIA' })).toBeVisible();
    await expect(page.getByText('28', { exact: true }).first()).toBeVisible();
  });

  test('quem só joga não vê as ações de dono', async ({ page, grupo }) => {
    await grupo.abrir('jogadores');
    const jogadores = new JogadoresPage(page);
    await expect(jogadores.linha('BIA')).toBeVisible();

    await expect(jogadores.botaoNovoJogador).toHaveCount(0);
    await expect(jogadores.botaoConvite).toHaveCount(0);
  });

  test('o dono vê cadastrar jogador e gerar convite', async ({ page, comoAlguem, grupo }) => {
    await comoAlguem('Rafa');
    await grupo.abrir('jogadores');
    const jogadores = new JogadoresPage(page);

    await expect(jogadores.botaoNovoJogador).toBeVisible();
    await expect(jogadores.botaoConvite).toBeVisible();
  });
});
