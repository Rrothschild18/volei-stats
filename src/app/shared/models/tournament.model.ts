export interface Tournament {
  id: string;
  name: string;
  sessionId: string;
  drawId: string;
  /** Formato do catálogo que conduz o chaveamento (REGRAS.md §10). */
  formatId: string;
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
  /** Desempates por par-ou-ímpar já decididos (REGRAS.md §9.3). */
  tiebreakDecisions: TiebreakDecision[];
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
  /** Dupla original que perdeu o par-ou-ímpar e foi desfeita no encaixe. */
  sourceTeamId: string;
  /** Nova dupla criada pelo encaixe (jogador vencedor + avulso). */
  encaixeTeamId: string;
  /** Jogador da dupla original que venceu o par-ou-ímpar e segue no campeonato. */
  survivingPlayerId: string;
  /** Jogador da dupla original que saiu e entra com prioridade no próximo sorteio. */
  eliminatedPlayerId: string;
  /** Quem registrou a decisão, e quando. */
  decidedBy: string | null;
  decidedAt: string | null;
}

export interface TournamentPriorityEntry {
  playerId: string;
  reason: TournamentPriorityReason;
}

export type TournamentPriorityReason =
  /* `waiting-draw` saiu: esperar no sorteio não gera prioridade (REGRAS.md §9.5). */
  'direct-elimination' | 'coin-flip-loss' | 'waiting-player-not-used';

/**
 * Desempate de diferença de pontos na fronteira que decide (REGRAS.md §9.3).
 * O app não escolhe sozinho: as duplas fazem par-ou-ímpar e alguém registra.
 */
export type TiebreakKind = 'losers' | 'winners';

export interface TiebreakDecision {
  kind: TiebreakKind;
  /** Duplas que empataram, na ordem em que foram apresentadas. */
  teamIds: string[];
  /** Dupla que venceu o par-ou-ímpar. */
  winnerTeamId: string;
  decidedBy: string | null;
  decidedAt: string;
}

/** Estado devolvido pela leitura da chave quando ela está pausada por empate. */
export interface PendingTiebreak {
  kind: TiebreakKind;
  teamIds: string[];
}
