export interface Team {
  id: string;
  playerIds: [string, string];
}

export interface DrawProposal {
  id: string;
  sessionId: string;
  teams: Team[];
  waitingPlayerId: string | null;
  score: number;
  badges: DrawBadge[];
  selected: boolean;
  createdAt: string;
}

export interface DrawBadge {
  teamId: string;
  type: 'same-gender' | 'repeated-pair' | 'priority-player';
  description: string;
}
