export interface TeamStats {
  playerIds: [string, string];
  playerNames: [string, string];
  gamesPlayed: number;
  wins: number;
  losses: number;
  winPercentage: number;
}

/** O mesmo que `TeamStats`, porém de UMA noite. Ver `PlayerSessionStats`. */
export interface TeamSessionStats {
  sessionId: string;
  playerIds: [string, string];
  gamesPlayed: number;
  wins: number;
  losses: number;
}
