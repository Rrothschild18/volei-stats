import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { expect, Page } from '@playwright/test';
import { environment } from '../src/environments/environment';

/**
 * A chave de serviço do Supabase **local**, perguntada ao CLI.
 *
 * Ela é uma constante pública do binário do `supabase` — igual em qualquer
 * máquina, e sem valor fora do Docker de quem a roda: o projeto da nuvem
 * responde "Invalid API key" a ela. Mesmo assim não fica escrita aqui, porque um
 * `sb_secret_…` no código é indistinguível de um segredo de verdade para quem lê
 * e para os scanners — e o GitHub recusa o push por causa dela. Quem sabe o
 * valor é o CLI, então é a ele que perguntamos.
 *
 * `SUPABASE_SECRET_KEY` tem precedência, para quem roda contra um Supabase que
 * não é o `supabase start` desta pasta.
 */
let chaveDeServico: string | null = null;

function serviceKey(): string {
  chaveDeServico ??= process.env['SUPABASE_SECRET_KEY'] ?? perguntaAoCli();
  return chaveDeServico;
}

function perguntaAoCli(): string {
  let saida: string;
  try {
    saida = execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8' });
  } catch {
    throw new Error(
      'Não deu para perguntar a chave ao `supabase status`. O Supabase local ' +
        'está de pé (`supabase start`)? Dá para passar a chave em ' +
        'SUPABASE_SECRET_KEY e dispensar o CLI.',
    );
  }
  const chave: unknown = JSON.parse(saida)['SECRET_KEY'];
  if (typeof chave !== 'string' || chave.length === 0) {
    throw new Error('`supabase status` respondeu sem SECRET_KEY.');
  }
  return chave;
}

/** O prefixo que marca o que é dos testes, para a limpeza saber o que apagar. */
export const E2E_PREFIX = 'e2e';

/** A senha que o grupo combina nos testes. */
export const SENHA_DO_GRUPO = 'volei99';

export function nomeDeVolei(qual: string): string {
  return `${E2E_PREFIX} ${qual} ${Date.now().toString(36)}`;
}

/**
 * Apaga tudo o que os testes criaram.
 *
 * As sessões saem antes dos grupos porque `session_players` referencia jogador
 * com `on delete restrict`: apagar o grupo direto para no meio do caminho. É a
 * mesma ordem do `seed.sql`, e pelo mesmo motivo.
 */
export async function limparVoleisDeTeste(): Promise<void> {
  const admin = createClient(environment.supabaseUrl, serviceKey(), {
    auth: { persistSession: false },
  });

  const { data } = await admin.from('groups').select('id').like('name', `${E2E_PREFIX} %`);
  const ids = (data ?? []).map((row: { id: string }) => row.id);
  if (ids.length === 0) {
    return;
  }

  await admin.from('sessions').delete().in('group_id', ids);
  await admin.from('groups').delete().in('id', ids);
}

/**
 * Apaga o usuário da sessão que este navegador guarda.
 *
 * É como se faz, de forma determinística, uma **sessão órfã**: o token continua
 * no navegador e continua assinado, e o usuário do outro lado sumiu. Acontece
 * de verdade a cada `supabase db reset` em desenvolvimento, e é o que fazia
 * entrar num vôlei morrer com um erro de banco cru.
 */
export async function matarUsuarioDaSessao(page: Page): Promise<boolean> {
  const id = await page.evaluate(() => {
    const chave = Object.keys(localStorage).find((k) => k.endsWith('-auth-token'));
    if (!chave) {
      return null;
    }
    const guardado = JSON.parse(localStorage.getItem(chave) ?? '{}') as { user?: { id?: string } };
    return guardado.user?.id ?? null;
  });

  if (!id) {
    return false;
  }

  const admin = createClient(environment.supabaseUrl, serviceKey(), {
    auth: { persistSession: false },
  });
  const { error } = await admin.auth.admin.deleteUser(id);
  return !error;
}

/**
 * Cria um vôlei pela tela, e devolve o código do convite.
 *
 * Passa pelo fluxo de verdade em vez de inserir no banco: criar é um dos
 * caminhos a cobrir, e assim cada teste começa de um vôlei que ele mesmo viu
 * nascer.
 */
export async function criarVolei(
  page: Page,
  nome: string,
  dono = 'Raul',
): Promise<{ codigo: string; groupId: string }> {
  await page.goto('/criar');
  await page.fill('#group-name', nome);
  await page.fill('#owner-name', dono);
  await preencherData(page, '#owner-date', '1988-07-23');
  await page.fill('#join-password', SENHA_DO_GRUPO);
  await page.getByRole('button', { name: 'CRIAR' }).click();

  await expect(page).toHaveURL(/\/g\/[0-9a-f-]+\/convite$/);
  const groupId = /\/g\/([0-9a-f-]+)\//.exec(page.url())![1];
  const codigo = (await page.locator('p.font-heading').first().innerText()).trim();

  return { codigo, groupId };
}

/** Cadastra alguém no vôlei, como o dono faz. */
export async function cadastrar(page: Page, groupId: string, nome: string): Promise<void> {
  await page.goto(`/g/${groupId}/jogadores/novo`);
  await page.fill('#player-name', nome);
  await page.getByRole('button', { name: 'SALVAR' }).click();
  await expect(page).toHaveURL(new RegExp(`/g/${groupId}/jogadores$`));
}

/** Diz quem eu sou: toca no nome, usa a senha do grupo e escolhe a própria data. */
export async function reivindicar(
  page: Page,
  groupId: string,
  nome: string,
  minhaData: string,
): Promise<void> {
  await page.goto(`/g/${groupId}/sou-quem`);
  await page.getByRole('button', { name: new RegExp(nome, 'i') }).click();
  await page.fill('#claim-password', SENHA_DO_GRUPO);
  await preencherData(page, '#claim-new-date', minhaData);
  await page.getByRole('button', { name: 'SOU EU' }).click();
  await expect(page).toHaveURL(new RegExp(`/g/${groupId}/inicio$`));
}

/**
 * Preenche um campo de data.
 *
 * Os testes falam em `aaaa-mm-dd`, que é o que o banco guarda; a tela pede
 * `dd/mm/aaaa`, que é como se digita aqui. A tradução mora neste lugar só.
 */
export async function preencherData(page: Page, seletor: string, iso: string): Promise<void> {
  const [ano, mes, dia] = iso.split('-');
  await page.fill(seletor, `${dia}/${mes}/${ano}`);
}

/** Mexe nos contadores do placar. Negativo desce. */
export async function ajustarPlacar(page: Page, a: number, b: number): Promise<void> {
  const mexer = async (label: string, quanto: number) => {
    const verbo = quanto >= 0 ? 'Aumentar' : 'Diminuir';
    const botao = page.getByRole('button', { name: `${verbo} ${label}` });
    for (let i = 0; i < Math.abs(quanto); i++) {
      await botao.click();
    }
  };
  await mexer('pontos da primeira dupla', a);
  await mexer('pontos da segunda dupla', b);
}
