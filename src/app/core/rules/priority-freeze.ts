/**
 * Quando as prioridades de um campeonato param de mudar (ticket 36).
 *
 * As entradas do sorteio seguinte são duas, e as duas congelam antes da final:
 * as prioridades e as duplas já formadas. As duplas existem desde o sorteio;
 * as prioridades nascem em três lugares, e nenhum deles é a semifinal ou a
 * final — `closeRound1()`, `applyOddPlayerPlacement()` e a criação do
 * campeonato. Quem perde a final não ganha preferência.
 *
 * Por isso o portão do sorteio não é "o campeonato acabou": é "o que o sorteio
 * lê já está decidido". Uma condição, não uma tabela de exceção por formato.
 */
export interface PriorityFreeze {
  /** `'completed'` dispensa a conta: um campeonato encerrado não muda mais. */
  readonly status: 'in-progress' | 'completed';
  /**
   * Quantas partidas de rodada 1 a abertura deste formato tem. Zero nos
   * formatos que abrem em semifinal ou em final direta: lá a eliminação direta
   * não existe, e a prioridade já está decidida desde a criação.
   */
  readonly expectedRound1Matches: number;
  readonly playedRound1Matches: number;
  /** Empate na fronteira que decide: a chave está pausada, nada está decidido. */
  readonly pendingTiebreak: boolean;
  readonly usesOddPlayerPlacement: boolean;
  readonly oddPlayerPlacementDecided: boolean;
}

/**
 * As prioridades deste campeonato já valem para o próximo sorteio.
 *
 * É mais preciso que "só falta a final": num formato de três partidas na
 * rodada 1 a condição cai mais tarde que num de duas, sem ninguém dizer.
 */
export function priorityFrozen(freeze: PriorityFreeze): boolean {
  if (freeze.status === 'completed') {
    return true;
  }

  if (freeze.expectedRound1Matches > freeze.playedRound1Matches) {
    return false;
  }

  if (freeze.pendingTiebreak) {
    return false;
  }

  // O par-ou-ímpar do encaixe ainda pode gerar prioridade ('coin-flip-loss') e
  // é ele que marca a eliminação direta nos campeonatos com avulso.
  return !(freeze.usesOddPlayerPlacement && !freeze.oddPlayerPlacementDecided);
}
