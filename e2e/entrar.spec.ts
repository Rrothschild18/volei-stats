import { expect, Page, test } from '@playwright/test';
import {
  cadastrar,
  criarVolei,
  DATA_DO_GRUPO,
  limparVoleisDeTeste,
  nomeDeVolei,
  reivindicar,
} from './apoio';

test.afterAll(limparVoleisDeTeste);

/** A linha de um jogador na lista, achada pelo nome que a tela mostra. */
function linha(page: Page, nome: string) {
  return page.getByRole('listitem').filter({ hasText: nome });
}

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

    // Quem foi cadastrado e ainda não disse quem é carrega a etiqueta: é como
    // quem organiza vê de relance quem falta cobrar. O dono não a tem, porque
    // entrou com a data dele no momento em que criou o vôlei.
    await expect(linha(page, 'BE')).toContainText('NÃO ENTROU');
    await expect(linha(page, 'CAIO')).toContainText('NÃO ENTROU');
    await expect(linha(page, 'RAUL')).toContainText('DONO');
    await expect(linha(page, 'RAUL')).not.toContainText('NÃO ENTROU');

    // O dono já entrou com a data dele: o nome dele não fica reivindicável.
    await page.goto(`/g/${groupId}/sou-quem`);
    // O nome acessível do botão traz o selo de sexo na frente ("Feminino Be").
    await expect(page.getByRole('button', { name: /Raul$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Be$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Caio$/ })).toBeVisible();
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

    // Antes de ela dizer quem é, a lista do dono a mostra como pendente.
    await page.goto(`/g/${groupId}/jogadores`);
    await expect(linha(page, 'VITÓRIA')).toContainText('NÃO ENTROU');

    await reivindicar(dela, groupId, 'Vitória', '1995-03-02');
    await expect(dela.getByText('VOCÊ ESTÁ SÓ OLHANDO')).toHaveCount(0);

    // E depois não mostra mais: a etiqueta é estado, não um campo que alguém
    // marca — some no instante em que a pessoa reivindica o nome.
    await page.goto(`/g/${groupId}/jogadores`);
    await expect(linha(page, 'VITÓRIA')).not.toContainText('NÃO ENTROU');

    await dela.goto('/voleis');
    // O selo do papel, e não qualquer texto com a palavra: "jogadores" do
    // rodapé do card também casaria.
    await expect(dela.locator('span.tag', { hasText: 'JOGADOR' })).toBeVisible();

    await outro.close();
  });

  test('código que não existe não diz se o vôlei existe', async ({ page }) => {
    await page.goto('/entrar');
    await page.fill('#join-code', 'ZZZZZZ');
    await page.getByRole('button', { name: 'ENTRAR' }).click();

    await expect(page.getByText('Código inválido')).toBeVisible();
    await expect(page).toHaveURL(/\/entrar$/);
  });

  test('sem rede, a tela diz isso e não joga fora o que foi digitado', async ({
    page,
    context,
  }) => {
    await page.goto('/entrar');
    await page.fill('#join-code', 'ABC123');

    await context.setOffline(true);
    await page.getByRole('button', { name: 'ENTRAR' }).click();

    await expect(page.getByText('Sem conexão · tentar de novo')).toBeVisible();
    await expect(page.locator('#join-code')).toHaveValue('ABC123');

    await context.setOffline(false);
  });
});
