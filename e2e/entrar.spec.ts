import { expect, Page, test } from '@playwright/test';
import {
  cadastrar,
  criarVolei,
  limparVoleisDeTeste,
  matarUsuarioDaSessao,
  nomeDeVolei,
  reivindicar,
  SENHA_DO_GRUPO,
} from './apoio';

test.afterAll(limparVoleisDeTeste);

/** A linha de um jogador na lista, achada pelo nome que a tela mostra. */
function linha(page: Page, nome: string) {
  return page.getByRole('listitem').filter({ hasText: nome });
}

/** O círculo da linha: ele é decorativo (`aria-hidden`), então vai por CSS. */
function sigla(page: Page, nome: string) {
  return linha(page, nome).locator('span[aria-hidden="true"]').first();
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

  test('a senha do grupo tem um mínimo, e a tela não deixa criar sem ela', async ({ page }) => {
    await page.goto('/criar');
    await page.fill('#group-name', nomeDeVolei('senha curta'));
    await page.fill('#owner-name', 'Raul');
    await page.fill('#owner-date', '1988-07-23');

    await page.fill('#join-password', 'ab');
    await expect(page.getByRole('button', { name: 'CRIAR' })).toBeDisabled();

    await page.fill('#join-password', SENHA_DO_GRUPO);
    await expect(page.getByRole('button', { name: 'CRIAR' })).toBeEnabled();
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

    // Senha errada não diz se o erro foi no nome ou na senha.
    await dela.goto(`/g/${groupId}/sou-quem`);
    await dela.getByRole('button', { name: /Vitória/i }).click();
    await dela.fill('#claim-password', 'senha-errada');
    await dela.fill('#claim-new-date', '1995-03-02');
    await dela.getByRole('button', { name: 'SOU EU' }).click();
    await expect(dela.getByText('Não deu certo. Confira o nome e a senha do grupo.')).toBeVisible();

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

  test('cada um ajusta o próprio nome, e a própria data', async ({ page, browser }) => {
    const { codigo, groupId } = await criarVolei(page, nomeDeVolei('nomes'), 'Raul');
    // O caso que motivou isto: três nomes que começam igual.
    await cadastrar(page, groupId, 'Raphael');
    await cadastrar(page, groupId, 'Rafael');

    // A sigla do círculo cresce só até deixar de empatar.
    await expect(sigla(page, 'RAUL')).toHaveText('RAU');
    await expect(sigla(page, 'RAPHAEL')).toHaveText('RAP');
    await expect(sigla(page, 'RAFAEL')).toHaveText('RAF');

    const dele = await browser.newContext();
    const ele = await dele.newPage();
    await ele.goto(`/entrar/${codigo}`);
    await ele.getByRole('button', { name: 'ENTRAR' }).click();
    // Esperar a tela chegar, e não só o clique sair: `reivindicar` navega, e
    // navegar antes de o resgate terminar faz o guard devolver para `/entrar`.
    await expect(ele).toHaveURL(new RegExp(`/g/${groupId}/sou-quem$`));
    await reivindicar(ele, groupId, 'Raphael', '1994-05-05');

    // ===== o nome =====
    await ele.goto(`/g/${groupId}/eu`);
    await ele.fill('#me-name', 'Rapha');
    await ele.getByRole('button', { name: 'SALVAR O NOME' }).click();
    await expect(ele.getByText('Nome trocado.')).toBeVisible();

    // Nome já usado no vôlei não passa: é único por vôlei.
    await ele.fill('#me-name', 'Rafael');
    await ele.getByRole('button', { name: 'SALVAR O NOME' }).click();
    await expect(ele.getByText(/Já tem alguém com esse nome/)).toBeVisible();

    // ===== a data =====
    // A atual é exigida: um celular emprestado já está dentro do app.
    await ele.fill('#me-current', '1900-01-01');
    await ele.fill('#me-next', '1988-01-01');
    await ele.getByRole('button', { name: 'SALVAR A DATA' }).click();
    await expect(ele.getByText('A data atual não confere.')).toBeVisible();

    await ele.fill('#me-current', '1994-05-05');
    await ele.fill('#me-next', '1988-01-01');
    await ele.getByRole('button', { name: 'SALVAR A DATA' }).click();
    await expect(ele.getByText(/Data trocada/)).toBeVisible();

    // O dono vê o nome novo, e a sigla acompanha.
    await page.goto(`/g/${groupId}/jogadores`);
    await expect(linha(page, 'RAPHA')).toBeVisible();
    await expect(linha(page, 'RAPHA')).not.toContainText('NÃO ENTROU');

    // E é a data nova que vale num aparelho novo.
    const terceiro = await browser.newContext();
    const tablet = await terceiro.newPage();
    await tablet.goto(`/entrar/${codigo}`);
    await tablet.getByRole('button', { name: 'ENTRAR' }).click();
    await expect(tablet).toHaveURL(new RegExp(`/g/${groupId}/sou-quem$`));
    await tablet.getByRole('button', { name: 'Já entrei antes, em outro aparelho' }).click();
    await tablet.fill('#claim-name', 'Rapha');
    await tablet.fill('#claim-own-date', '1988-01-01');
    await tablet.getByRole('button', { name: 'SOU EU' }).click();
    await expect(tablet).toHaveURL(new RegExp(`/g/${groupId}/inicio$`));

    await dele.close();
    await terceiro.close();
  });

  test('usar o mesmo código já tendo dito quem é entra direto', async ({ page, browser }) => {
    const { codigo, groupId } = await criarVolei(page, nomeDeVolei('de novo'), 'Raul');
    await cadastrar(page, groupId, 'Be');

    const dela = await browser.newContext();
    const ela = await dela.newPage();
    await ela.goto(`/entrar/${codigo}`);
    await ela.getByRole('button', { name: 'ENTRAR' }).click();
    await expect(ela).toHaveURL(new RegExp(`/g/${groupId}/sou-quem$`));
    await reivindicar(ela, groupId, 'Be', '1996-03-03');

    // O link fica no grupo do zap, e a pessoa toca nele sem pensar. Perguntar
    // "quem você é?" a quem já respondeu não leva a lugar nenhum — o nome dela
    // nem aparece na lista, porque já tem dono.
    await ela.goto(`/entrar/${codigo}`);
    await ela.getByRole('button', { name: 'ENTRAR' }).click();
    await expect(ela).toHaveURL(new RegExp(`/g/${groupId}/inicio$`));

    await dela.close();
  });

  test('sessão cujo usuário sumiu não quebra: o app pega outra', async ({ page, browser }) => {
    const { codigo, groupId } = await criarVolei(page, nomeDeVolei('órfã'), 'Raul');
    await cadastrar(page, groupId, 'Be');

    const dela = await browser.newContext();
    const ela = await dela.newPage();

    // Primeiro uma sessão de verdade, para haver o que matar.
    await ela.goto('/entrar');
    await ela.fill('#join-code', 'ZZZZZZ');
    await ela.getByRole('button', { name: 'ENTRAR' }).click();
    await expect(ela.getByText('Código inválido')).toBeVisible();
    expect(await matarUsuarioDaSessao(ela)).toBe(true);

    // Agora o token do navegador aponta para um usuário que não existe mais.
    // Antes disto, entrar morria com "violates foreign key constraint".
    //
    // `domcontentloaded`: a tela anterior deixou pedidos em voo que morrem com
    // a sessão, e esperar por `load` esperaria por eles.
    await ela.goto(`/entrar/${codigo}`, { waitUntil: 'domcontentloaded' });
    await ela.getByRole('button', { name: 'ENTRAR' }).click();
    await expect(ela).toHaveURL(new RegExp(`/g/${groupId}/sou-quem$`));
    await expect(ela.getByRole('button', { name: /Be$/ })).toBeVisible();

    await dela.close();
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
