/**
 * O portão que impede o app de ser publicado na frente do schema.
 *
 * `deploy.yml` dispara no push da `main`: o push É o deploy. O schema vai por
 * outro caminho (`supabase db push`), e nada ligava as duas coisas — em
 * 01/11/2026 duas migrations ficaram paradas na máquina enquanto o app que
 * depende delas estava a um `git push` de ir ao ar. O que avisou foi alguém
 * lembrar.
 *
 * Publicar um app que chama uma função que não existe na nuvem não dá erro de
 * build: dá erro na mão de quem está com o celular na quadra.
 */

/**
 * Lê a saída de `supabase migration list --linked --output-format json` e
 * devolve as migrations locais que a nuvem ainda não aplicou.
 *
 * O CLI escreve ruído antes do JSON ("Initialising login role...", "Connecting
 * to remote database..."), então a leitura começa no primeiro `{` e vai até o
 * fim. Pegar "a última linha que começa com `{`" parecia equivalente e não é:
 * com JSON indentado essa linha é a abertura de um objeto ANINHADO, e o
 * `JSON.parse` morre num `SyntaxError` cru em vez da mensagem daqui.
 *
 * Tudo o que não dá para ler vira exceção, nunca lista vazia. Um portão que
 * não consegue perguntar tem de gritar: tratar "não sei" como "não falta nada"
 * publicaria o app na frente do schema exatamente quando o banco está
 * inalcançável.
 */
export function migrationsPendentes(saida) {
  const inicio = saida.indexOf('{');
  if (inicio < 0) {
    throw new Error(`A saída do CLI não trouxe JSON:\n${saida}`);
  }

  let lido;
  try {
    lido = JSON.parse(saida.slice(inicio));
  } catch (erro) {
    throw new Error(`Não deu para ler a saída do CLI (${erro.message}):\n${saida}`);
  }

  if (!Array.isArray(lido?.migrations)) {
    throw new Error(`A saída do CLI não trouxe a lista de migrations:\n${saida}`);
  }

  return lido.migrations.filter((m) => m.local && !m.remote).map((m) => m.local);
}

/**
 * O que a esteira imprime quando para. Quem lê isto é alguém olhando um deploy
 * vermelho sem contexto nenhum, então a mensagem precisa dizer as três coisas:
 * o que falta, por que isso para o deploy, e o comando que resolve.
 */
export function mensagemDeFalha(pendentes) {
  const quantas = pendentes.length === 1 ? '1 migration' : `${pendentes.length} migrations`;

  return [
    `O schema da nuvem está atrás do repositório: ${quantas} sem aplicar.`,
    '',
    ...pendentes.map((nome) => `  • ${nome}`),
    '',
    'O deploy parou aqui de propósito. Publicar agora poria no ar um app que',
    'chama função que ainda não existe no banco — e isso não dá erro de build,',
    'dá erro na mão de quem está com o celular na quadra.',
    '',
    'Para aplicar, com o CLI logado e o projeto ligado:',
    '',
    '  supabase db push --linked --dry-run   # confere o que subiria',
    '  supabase db push --linked             # aplica',
    '',
    'Depois, empurre de novo.',
  ].join('\n');
}

/**
 * Daqui para baixo é fiação, e ela não tem teste: chamar o CLI, ler a saída,
 * sair com o código certo. O que se pode errar aqui — o projeto não estar
 * ligado, o segredo estar errado, o CLI escrever noutro lugar — só aparece
 * rodando de verdade, e é por isso que a falha é barulhenta.
 *
 * O `--linked` exige que o projeto esteja ligado: na máquina isso já é verdade
 * desde o `supabase link`; na esteira, o passo anterior do workflow liga.
 */
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

function principal() {
  let saida;
  try {
    saida = execFileSync('supabase', ['migration', 'list', '--linked', '--output-format', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (erro) {
    console.error(
      'Não deu para perguntar à nuvem quais migrations estão aplicadas.\n' +
        'O projeto está ligado (`supabase link`) e o login vale?\n\n' +
        (erro.stderr || erro.message),
    );
    process.exit(1);
  }

  const pendentes = migrationsPendentes(saida);

  if (pendentes.length > 0) {
    console.error(mensagemDeFalha(pendentes));
    process.exit(1);
  }

  console.log('O schema da nuvem está em dia com `supabase/migrations/`.');
}

/**
 * `realpathSync` não é zelo: o Node põe em `argv[1]` o caminho como foi
 * digitado, e resolve o módulo pelo caminho real. Com um link simbólico em
 * qualquer parte do caminho — o workspace de um runner, um `~` que aponta para
 * outro lugar —, os dois diferem, `principal()` nunca roda, o processo sai 0 e
 * o portão passa a aprovar tudo em silêncio. Falhar ABERTO é o pior jeito de um
 * portão falhar, e é justamente o que ele existe para impedir.
 */
function ehOProgramaPrincipal() {
  try {
    return argv[1] !== undefined && realpathSync(argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (ehOProgramaPrincipal()) {
  principal();
}
