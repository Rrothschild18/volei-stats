import { expect, test } from '@playwright/test';
import {
  cadastrar,
  criarVolei,
  DATA_DO_GRUPO,
  limparVoleisDeTeste,
  nomeDeVolei,
  reivindicar,
} from './apoio';

test.afterAll(limparVoleisDeTeste);

/**
 * A porta do app: criar um vôlei, e alguém entrar nele.
 *
 * É o caminho que não tem atalho — sem ele, ninguém chega a nenhuma outra tela.
 */
test.describe('entrar num vôlei', () => {
  test('criar o vôlei, cadastrar o pessoal e mandar o código', async ({ page }) => {
    const nome = nomeDeVolei('entrar');
    const { codigo, groupId } = await criarVolei(page, nome, 'Raul');

    // O código é o que vai no zap: curto, e sem os caracteres que se confundem.
    expect(codigo).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    await cadastrar(page, groupId, 'Be');
    await cadastrar(page, groupId, 'Caio');
    await expect(page.getByText('ATIVOS · 3')).toBeVisible();

    // O dono já entrou com a data dele: o nome dele não fica reivindicável.
    await page.goto(`/g/${groupId}/sou-quem`);
    await expect(page.getByRole('button', { name: /^Masculino RAUL$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /BE/ })).toBeVisible();
  });

  test('a sua data não pode ser a que o grupo vai combinar', async ({ page }) => {
    await page.goto('/criar');
    await page.fill('#group-name', nomeDeVolei('datas iguais'));
    await page.fill('#owner-name', 'Raul');
    await page.fill('#owner-date', DATA_DO_GRUPO);
    await page.fill('#initial-date', DATA_DO_GRUPO);

    // Se fossem iguais, o nome do dono ficaria destrancado pela senha que ele
    // mesmo manda no grupo.
    await expect(page.getByText(/tem de ser diferente da data inicial/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'CRIAR' })).toBeDisabled();
  });

  test('outro aparelho entra pelo código e diz quem é', async ({ page, browser }) => {
    const { codigo, groupId } = await criarVolei(page, nomeDeVolei('código'), 'Raul');
    await cadastrar(page, groupId, 'Vitória');

    // Um contexto novo é um navegador novo: outra sessão anônima, como a do
    // celular de outra pessoa.
    const outro = await browser.newContext();
    const dela = await outro.newPage();

    await dela.goto('/entrar');
    // Caixa trocada e espaço nas pontas não importam: o código é ditado.
    await dela.fill('#join-code', `  ${codigo.toLowerCase()} `);
    await dela.getByRole('button', { name: 'ENTRAR' }).click();
    await expect(dela).toHaveURL(new RegExp(`/g/${groupId}/sou-quem$`));

    // Enquanto não disser quem é, ela lê e não escreve.
    await dela.goto(`/g/${groupId}/inicio`);
    await expect(dela.getByText('VOCÊ ESTÁ SÓ OLHANDO')).toBeVisible();

    // Data errada não diz se o erro foi no nome ou na data.
    await dela.goto(`/g/${groupId}/sou-quem`);
    await dela.getByRole('button', { name: /Vitória/i }).click();
    await dela.fill('#claim-group-date', '1991-01-01');
    await dela.fill('#claim-new-date', '1995-03-02');
    await dela.getByRole('button', { name: 'SOU EU' }).click();
    await expect(dela.getByText('Não deu certo. Confira o nome e a data.')).toBeVisible();

    await reivindicar(dela, groupId, 'Vitória', '1995-03-02');
    await expect(dela.getByText('VOCÊ ESTÁ SÓ OLHANDO')).toHaveCount(0);

    await dela.goto('/voleis');
    await expect(dela.getByText('JOGADOR')).toBeVisible();

    await outro.close();
  });

  test('código que não existe não diz se o vôlei existe', async ({ page }) => {
    await page.goto('/entrar');
    await page.fill('#join-code', 'ZZZZZZ');
    await page.getByRole('button', { name: 'ENTRAR' }).click();

    await expect(page.getByText('Código inválido')).toBeVisible();
    await expect(page).toHaveURL(/\/entrar$/);
  });

  test('sem rede, a tela diz isso e não joga fora o que foi digitado', async ({ page, context }) => {
    await page.goto('/entrar');
    await page.fill('#join-code', 'ABC123');

    await context.setOffline(true);
    await page.getByRole('button', { name: 'ENTRAR' }).click();

    await expect(page.getByText('Sem conexão · tentar de novo')).toBeVisible();
    await expect(page.locator('#join-code')).toHaveValue('ABC123');

    await context.setOffline(false);
  });
});
