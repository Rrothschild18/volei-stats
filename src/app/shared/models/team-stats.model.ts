export interface TeamStats {
  playerIds: [string, string];
  playerNames: [string, string];
  gamesPlayed: number;
  wins: number;
  losses: number;
  winPercentage: number;
}
