export interface Tournament {
  id: string;
  sessionId: string;
  drawId: string;
  teams: TournamentTeam[];
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
}

export interface TournamentStanding {
  teamId: string;
  position: number;
}
