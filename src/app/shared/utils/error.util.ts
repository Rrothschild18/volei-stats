/** O que a tela diz quando a rede é o problema. */
export const OFFLINE_MESSAGE = 'Sem conexão · tentar de novo';

/**
 * Nome de constraint do banco → frase que a pessoa lê no lugar.
 *
 * Chave nova entra aqui, nunca espalhada pelos serviços: antes disto, cada
 * repositório tinha sua própria lista solta, e a tradução de uma violação só
 * valia para quem lembrava de checar `error.message` na mão.
 */
const KNOWN_CONSTRAINTS: Record<string, string> = {
  players_name_key: 'Já tem alguém com esse nome neste vôlei. Escolha outro.',
  invites_code_key: 'Esse código já está em uso por outro vôlei. Escolha outro.',
  invites_code_shape: 'O código aceita letras, números e hífen, com pelo menos 3 caracteres.',
};

interface DatabaseRule {
  readonly pattern: RegExp;
  readonly message: (match: RegExpMatchArray) => string;
}

/**
 * O Postgres fala sempre a mesma língua para cada família de erro — é esse
 * texto em inglês, com nomes de tabela e coluna, que chegava cru na tela. As
 * regras abaixo o reconhecem pela forma, não pelo caso específico, então uma
 * chave estrangeira nova em qualquer tabela já sai traduzida.
 */
const DATABASE_RULES: readonly DatabaseRule[] = [
  {
    // "duplicate key value violates unique constraint "x"" e o check constraint
    // de formato (ex.: invites_code_shape) têm a mesma forma de mensagem.
    pattern: /violates (?:unique|check) constraint "([^"]+)"/i,
    message: (match) => KNOWN_CONSTRAINTS[match[1]] ?? 'Já existe um registro igual a esse.',
  },
  {
    pattern: /violates foreign key constraint "([^"]+)"/i,
    message: (match) =>
      KNOWN_CONSTRAINTS[match[1]] ??
      'Essa ação depende de algo que não existe mais. Atualize a tela e tente de novo.',
  },
  {
    pattern: /violates not-null constraint/i,
    message: () => 'Falta uma informação obrigatória.',
  },
  {
    pattern: /row-level security policy|permission denied/i,
    message: () => 'Você não tem permissão para fazer isso.',
  },
  {
    pattern: /jwt|invalid claim/i,
    message: () => 'Sua sessão expirou. Entre de novo.',
  },
];

/** Qualquer outro sinal de que o texto veio do banco, e não foi escrito para alguém ler. */
const RAW_DATABASE_TEXT =
  /violates|constraint|relation "|duplicate key|permission denied|does not exist|syntax error/i;

function isOffline(cause: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  return cause instanceof Error && /fetch|network|NetworkError/i.test(cause.message);
}

function fromDatabaseText(message: string): string | null {
  for (const rule of DATABASE_RULES) {
    const match = message.match(rule.pattern);
    if (match) {
      return rule.message(match);
    }
  }
  return null;
}

/**
 * Transforma uma falha em frase para a pessoa ler.
 *
 * Sem rede vem primeiro porque a mensagem de baixo é inútil nesse caso: o
 * cliente do Supabase embrulha "Failed to fetch" numa frase sobre o banco, e o
 * problema não é o banco. Depois vêm as regras do banco, pela forma da
 * mensagem — e se nada bater mas o texto ainda assim tiver cara de erro de
 * banco (nome de tabela, de constraint), a pessoa recebe o fallback, nunca o
 * texto cru. Nada é jogado fora quando isto aparece: a tela mantém o que foi
 * digitado, e a pessoa tenta de novo.
 */
export function describeError(cause: unknown, fallback = 'Não deu certo.'): string {
  if (isOffline(cause)) {
    return OFFLINE_MESSAGE;
  }
  if (!(cause instanceof Error)) {
    return fallback;
  }

  const translated = fromDatabaseText(cause.message);
  if (translated) {
    return translated;
  }
  if (RAW_DATABASE_TEXT.test(cause.message)) {
    return fallback;
  }
  return cause.message;
}
