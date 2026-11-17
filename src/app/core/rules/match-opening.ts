/**
 * O início do jogo (ticket 07): o par-ou-ímpar, o lado da quadra e quem abre
 * sacando.
 *
 * Tudo aqui é opcional. Quem só quer lançar o resultado continua lançando, e
 * as partidas lançadas antes deste registro seguem válidas — por isso cada
 * campo é anulável, e a estatística que se apoiar neles tem de contar sobre
 * quantas partidas ela está falando.
 */
import { CoinChoice, CourtSide } from '../../shared/models';

export interface MatchOpening {
  /** Dupla que venceu o par-ou-ímpar. */
  readonly coinWinnerTeamId: string | null;
  /** Quem chamou par ou ímpar pela dupla vencedora. */
  readonly coinCallerPlayerId: string | null;
  readonly coinChoice: CoinChoice | null;
  /** O lado da PRIMEIRA dupla. O da outra é o oposto — duas colunas poderiam discordar. */
  readonly teamASide: CourtSide | null;
}

/**
 * Quem abre sacando: quem ganhou o par-ou-ímpar e escolheu **saque**, ou a
 * outra dupla quando a escolha foi **lado**.
 *
 * É derivado, e não perguntado de novo: perguntar seria deixar o app aceitar
 * uma resposta que contradiz a anterior.
 */
export function quemAbreSacando(entrada: {
  coinWinnerTeamId: string | null;
  coinChoice: CoinChoice | null;
  teamAId: string;
  teamBId: string;
}): string | null {
  const { coinWinnerTeamId, coinChoice, teamAId, teamBId } = entrada;

  if (!coinWinnerTeamId || !coinChoice) {
    return null;
  }

  if (coinChoice === 'saque') {
    return coinWinnerTeamId;
  }

  return coinWinnerTeamId === teamAId ? teamBId : teamAId;
}

/** O lado da outra dupla, que é sempre o oposto. */
export function ladoOposto(side: CourtSide): CourtSide {
  return side === 'esquerda' ? 'direita' : 'esquerda';
}
