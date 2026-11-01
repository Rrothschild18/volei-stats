/**
 * Preenche `src/environments/environment.prod.ts` com as credenciais da nuvem.
 *
 * Roda no deploy, antes do build. As duas variáveis são do GitHub Actions
 * (Settings → Secrets and variables → Actions → Variables) e não são segredo: a
 * chave publicável termina no bundle que o GitHub Pages serve, visível a quem
 * abrir o devtools. Estão fora do repositório por organização — trocar de
 * projeto não deveria ser um commit —, não por sigilo.
 *
 * Falta de variável derruba o deploy aqui, de propósito: o build compila com os
 * valores vazios, e sem este corte o Pages publicaria uma tela que não carrega
 * nada e não diz por quê.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ARQUIVO = 'src/environments/environment.prod.ts';

const url = process.env.SUPABASE_URL?.trim();
const chave = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

const faltando = [
  ['SUPABASE_URL', url],
  ['SUPABASE_PUBLISHABLE_KEY', chave],
]
  .filter(([, valor]) => !valor)
  .map(([nome]) => nome);

if (faltando.length > 0) {
  console.error(
    `Faltam as variáveis ${faltando.join(' e ')}.\n` +
      'Elas ficam em Settings → Secrets and variables → Actions → Variables, ' +
      'no repositório.',
  );
  process.exit(1);
}

if (chave.startsWith('sb_secret_') || chave.includes('service_role')) {
  console.error(
    'SUPABASE_PUBLISHABLE_KEY recebeu uma chave secreta. Ela ignora as ' +
      'políticas do banco e não pode ir para o navegador — use a publicável ' +
      '(`sb_publishable_…`, a mesma que o dashboard chama de anon).',
  );
  process.exit(1);
}

const original = readFileSync(ARQUIVO, 'utf8');
const preenchido = original
  .replace(/supabaseUrl: '.*'/, `supabaseUrl: '${url}'`)
  .replace(/supabasePublishableKey: '.*'/, `supabasePublishableKey: '${chave}'`);

if (preenchido === original) {
  console.error(`Nada mudou em ${ARQUIVO} — o formato do arquivo saiu do esperado.`);
  process.exit(1);
}

writeFileSync(ARQUIVO, preenchido);
console.log(`${ARQUIVO}: ${url}`);
