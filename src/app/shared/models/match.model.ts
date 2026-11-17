export interface Match {
  id: string;
  tournamentId: string;
  sessionId: string;
  phase: MatchPhase;
  teamAId: string;
  teamBId: string;
  scoreA: number;
  scoreB: number;
  winnerId: string | null;
  loserId: string | null;
  pointDifference: number;
  playedAt: string;
  /** Quem lançou o placar: o primeiro insert trava a partida. */
  reportedBy: string | null;
  /** Quem corrigiu um placar já lançado. Corrigir é de qualquer jogador. */
  correctedBy: string | null;
  correctedAt: string | null;
  createdAt: string;
  /**
   * O início do jogo (ticket 07): par-ou-ímpar, lado da quadra e quem abriu
   * sacando. Nulo quando ninguém registrou — o passo é pulável, e as partidas
   * lançadas antes dele seguem válidas.
   */
  coinWinnerTeamId: string | null;
  coinCallerPlayerId: string | null;
  coinChoice: CoinChoice | null;
  /** O lado da PRIMEIRA dupla; o da outra é o oposto. */
  teamASide: CourtSide | null;
  firstServerTeamId: string | null;
}

export type CoinChoice = 'saque' | 'lado';
export type CourtSide = 'esquerda' | 'direita';

export type MatchPhase = 'round-1' | 'semifinal' | 'semifinal-bye' | 'final' | 'third-place';
