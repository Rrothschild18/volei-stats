/** O que a tela diz quando a rede é o problema. */
export const OFFLINE_MESSAGE = 'Sem conexão · tentar de novo';

/**
 * Transforma uma falha em frase para a pessoa ler.
 *
 * Sem rede vem primeiro porque a mensagem de baixo é inútil nesse caso: o
 * cliente do Supabase embrulha "Failed to fetch" numa frase sobre o banco, e o
 * problema não é o banco. E nada é jogado fora quando isto aparece: a tela
 * mantém o que foi digitado, e a pessoa tenta de novo.
 */
export function describeError(cause: unknown, fallback = 'Não deu certo.'): string {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return OFFLINE_MESSAGE;
  }
  if (cause instanceof Error && /fetch|network|NetworkError/i.test(cause.message)) {
    return OFFLINE_MESSAGE;
  }
  return cause instanceof Error ? cause.message : fallback;
}
