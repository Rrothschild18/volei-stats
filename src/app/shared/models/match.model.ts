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
}

export type MatchPhase = 'round-1' | 'semifinal' | 'semifinal-bye' | 'final' | 'third-place';
