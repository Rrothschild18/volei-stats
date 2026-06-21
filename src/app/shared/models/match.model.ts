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
  createdAt: string;
}

export type MatchPhase = 'round-1' | 'semifinal' | 'semifinal-bye' | 'final' | 'third-place';
