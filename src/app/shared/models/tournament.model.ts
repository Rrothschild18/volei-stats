export interface Tournament {
  id: string;
  sessionId: string;
  drawId: string;
  teams: TournamentTeam[];
  waitingPlayerId: string | null;
  oddPlayerPlacementEnabled: boolean;
  oddPlayerLoserPriorityEnabled: boolean;
  oddPlayerPlacement: OddPlayerPlacement | null;
  priorityEntries: TournamentPriorityEntry[];
  pointLimit: number;
  thirdPlaceEnabled: boolean;
  matches: string[];
  status: 'in-progress' | 'completed';
  finalStandings: TournamentStanding[];
  createdAt: string;
  updatedAt: string;
}

export interface TournamentTeam {
  id: string;
  playerIds: [string, string];
  eliminated: boolean;
  eliminatedDirectly: boolean;
  synthetic: boolean;
  originalPlayerIds: [string, string] | null;
}

export interface TournamentStanding {
  teamId: string;
  position: number;
}

export interface OddPlayerPlacement {
  sourceTeamId: string;
  survivingPlayerId: string;
  eliminatedPlayerId: string;
}

export interface TournamentPriorityEntry {
  playerId: string;
  reason: TournamentPriorityReason;
}

export type TournamentPriorityReason =
  | 'waiting-draw'
  | 'direct-elimination'
  | 'coin-flip-loss'
  | 'waiting-player-not-used';
