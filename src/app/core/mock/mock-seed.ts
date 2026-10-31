import { STORES } from '../database/database.config';
import { Gender } from '../../shared/enums';
import {
  DrawProposal,
  Group,
  GroupMember,
  GroupRole,
  Match,
  MatchPhase,
  Player,
  Session,
  Tournament,
  TournamentTeam,
} from '../../shared/models';

/**
 * Cenário de exemplo do redesign, para rodar o app local sem backend.
 *
 * É o mesmo cenário das telas do handoff: Vôlei Segunda com 11 presentes, o
 * campeonato 1 finalizado (campeões Rafa + Bia) e o campeonato 2 ao vivo na
 * semifinal do bye. Antes disso, alguns meses de histórico para os rankings e
 * os perfis terem números de verdade.
 *
 * As datas são relativas a hoje, então a "sessão de hoje" é sempre hoje.
 */

/** Gerador determinístico: o cenário precisa ser o mesmo a cada carga. */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20261026);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function dateString(daysAgo: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function timestamp(daysAgo: number, hour: number, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

interface PlayerSpec {
  readonly id: string;
  readonly name: string;
  readonly gender: Gender;
  readonly active?: boolean;
}

const PLAYER_SPECS: readonly PlayerSpec[] = [
  { id: 'p-rafa', name: 'Rafa', gender: Gender.MALE },
  { id: 'p-bia', name: 'Bia', gender: Gender.FEMALE },
  { id: 'p-duda', name: 'Duda', gender: Gender.FEMALE },
  { id: 'p-leo', name: 'Léo', gender: Gender.MALE },
  { id: 'p-carol', name: 'Carol', gender: Gender.FEMALE },
  { id: 'p-thiago', name: 'Thiago', gender: Gender.MALE },
  { id: 'p-nina', name: 'Nina', gender: Gender.FEMALE },
  { id: 'p-gui', name: 'Gui', gender: Gender.MALE },
  { id: 'p-paty', name: 'Paty', gender: Gender.FEMALE },
  { id: 'p-caio', name: 'Caio', gender: Gender.MALE },
  { id: 'p-malu', name: 'Malu', gender: Gender.FEMALE },
  { id: 'p-dani', name: 'Dani', gender: Gender.FEMALE },
  { id: 'p-edu', name: 'Edu', gender: Gender.MALE },
  { id: 'p-tati', name: 'Tati', gender: Gender.FEMALE },
  { id: 'p-rogerio', name: 'Rogério', gender: Gender.MALE, active: false },
  { id: 'p-sil', name: 'Sil', gender: Gender.FEMALE, active: false },
  { id: 'p-vivi', name: 'Vivi', gender: Gender.FEMALE },
  { id: 'p-juca', name: 'Juca', gender: Gender.MALE },
  { id: 'p-bruno', name: 'Bruno', gender: Gender.MALE },
  { id: 'p-le', name: 'Lê', gender: Gender.FEMALE },
];

export const GROUP_SEGUNDA = 'g-segunda';
export const GROUP_TRABALHO = 'g-trabalho';

/**
 * Quem criou cada vôlei. Entrar como o dono de um e jogador do outro é o jeito
 * de ver as duas visões sem backend — é o mesmo cenário do handoff.
 */
export const GROUP_SEGUNDA_OWNER = 'p-rafa';
export const GROUP_TRABALHO_OWNER = 'p-caio';

/** O usuário do mock: jogador no Vôlei Segunda, dono do Vôlei Trabalho. */
export const MOCK_USER_PLAYER_ID = 'p-caio';

const SEGUNDA_MEMBERS: readonly (readonly [string, GroupRole])[] = [
  ['p-rafa', 'player'],
  ['p-duda', 'player'],
  ['p-bia', 'player'],
  ['p-leo', 'player'],
  ['p-carol', 'player'],
  ['p-thiago', 'player'],
  ['p-nina', 'player'],
  ['p-gui', 'player'],
  ['p-paty', 'player'],
  ['p-caio', 'player'],
  ['p-malu', 'player'],
  ['p-dani', 'player'],
  ['p-edu', 'player'],
  ['p-tati', 'player'],
  ['p-rogerio', 'player'],
  ['p-sil', 'player'],
];

const TRABALHO_MEMBERS: readonly (readonly [string, GroupRole])[] = [
  ['p-caio', 'player'],
  ['p-rafa', 'player'],
  ['p-nina', 'player'],
  ['p-edu', 'player'],
  ['p-vivi', 'player'],
  ['p-juca', 'player'],
  ['p-bruno', 'player'],
  ['p-le', 'player'],
  ['p-tati', 'player'],
];

/** Os 11 que apareceram hoje no Vôlei Segunda. */
const PRESENT_TODAY = [
  'p-rafa',
  'p-bia',
  'p-duda',
  'p-leo',
  'p-carol',
  'p-thiago',
  'p-nina',
  'p-gui',
  'p-paty',
  'p-caio',
  'p-malu',
];

const HISTORY_NAMES = [
  'Escola Raul de forehand',
  'Dava pra ter chego',
  'Tem dia que é noite',
  'Não tem recepção',
  'Valendo o aluguel da quadra',
  'Marca a quadra das 9',
  'A luz atrapalhou',
  'Peguei rede',
  'Cade a lista',
  'Fora bola',
  'Bicho do pé',
  'Quanto tá isso daí?',
  'Só ganha por conta da rede',
  'Fica vendo que agora vai errar',
  'Solta a lista',
  'Pezao beach sports',
];

interface Draft {
  readonly players: Player[];
  readonly groups: Group[];
  readonly members: GroupMember[];
  readonly sessions: Session[];
  readonly draws: DrawProposal[];
  readonly tournaments: Tournament[];
  readonly matches: Match[];
}

function team(id: string, playerIds: [string, string]): TournamentTeam {
  return {
    id,
    playerIds,
    eliminated: false,
    eliminatedDirectly: false,
    synthetic: false,
    originalPlayerIds: null,
  };
}

interface MatchSpec {
  readonly id: string;
  readonly tournamentId: string;
  readonly sessionId: string;
  readonly phase: MatchPhase;
  readonly teamAId: string;
  readonly teamBId: string;
  readonly scoreA: number;
  readonly scoreB: number;
  readonly playedAt: string;
  readonly reportedBy: string | null;
}

function match(spec: MatchSpec): Match {
  const { scoreA, scoreB } = spec;
  return {
    id: spec.id,
    tournamentId: spec.tournamentId,
    sessionId: spec.sessionId,
    phase: spec.phase,
    teamAId: spec.teamAId,
    teamBId: spec.teamBId,
    scoreA,
    scoreB,
    winnerId: scoreA > scoreB ? spec.teamAId : spec.teamBId,
    loserId: scoreA > scoreB ? spec.teamBId : spec.teamAId,
    pointDifference: Math.abs(scoreA - scoreB),
    playedAt: spec.playedAt,
    reportedBy: spec.reportedBy,
    correctedBy: null,
    correctedAt: null,
    createdAt: spec.playedAt,
  };
}

function baseTournament(overrides: Partial<Tournament> & Pick<Tournament, 'id' | 'sessionId'>) {
  const tournament: Tournament = {
    name: 'Campeonato',
    drawId: '',
    formatId: 'encaixe-5',
    teams: [],
    waitingPlayerId: null,
    oddPlayerPlacementEnabled: false,
    oddPlayerLoserPriorityEnabled: true,
    oddPlayerPlacement: null,
    priorityEntries: [],
    pointLimit: 12,
    thirdPlaceEnabled: false,
    matches: [],
    status: 'completed',
    finalStandings: [],
    tiebreakDecisions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
  return tournament;
}

/**
 * Sessão de histórico: um sorteio escolhido (mais duas propostas descartadas,
 * que é o que o §7.6 manda não contar) e um campeonato de 4 duplas resolvido em
 * semifinais, final e 3º lugar.
 */
function seedPastSession(draft: Draft, groupId: string, pool: string[], daysAgo: number): void {
  const index = daysAgo;
  const sessionId = `s-${groupId}-${index}`;
  const present = shuffled(pool).slice(0, 8);
  const sorted = shuffled(present);
  const teams = [
    team(`t-${sessionId}-1`, [sorted[0], sorted[1]]),
    team(`t-${sessionId}-2`, [sorted[2], sorted[3]]),
    team(`t-${sessionId}-3`, [sorted[4], sorted[5]]),
    team(`t-${sessionId}-4`, [sorted[6], sorted[7]]),
  ];

  const tournamentId = `tn-${sessionId}`;
  const date = dateString(daysAgo);

  const selectedDraw: DrawProposal = {
    id: `d-${sessionId}-a`,
    sessionId,
    teams: teams.map((entry) => ({ id: entry.id, playerIds: entry.playerIds })),
    waitingPlayerId: null,
    score: 100,
    badges: [],
    selected: true,
    createdAt: timestamp(daysAgo, 19, 30),
  };

  // Propostas não escolhidas: existem para o sorteio ter 3 opções, mas não
  // contam como sorteio nem como espera (REGRAS.md §7.6).
  const discarded: DrawProposal[] = ['b', 'c'].map((letter, position) => ({
    id: `d-${sessionId}-${letter}`,
    sessionId,
    teams: selectedDraw.teams,
    waitingPlayerId: pool[(index + position) % pool.length],
    score: 90 - position * 10,
    badges: [],
    selected: false,
    createdAt: timestamp(daysAgo, 19, 31 + position),
  }));

  const semiA = match({
    id: `m-${tournamentId}-1`,
    tournamentId,
    sessionId,
    phase: 'semifinal',
    teamAId: teams[0].id,
    teamBId: teams[1].id,
    scoreA: 12,
    scoreB: 5 + Math.floor(random() * 6),
    playedAt: timestamp(daysAgo, 19, 50),
    reportedBy: pick(present),
  });
  const semiB = match({
    id: `m-${tournamentId}-2`,
    tournamentId,
    sessionId,
    phase: 'semifinal',
    teamAId: teams[2].id,
    teamBId: teams[3].id,
    scoreA: 6 + Math.floor(random() * 6),
    scoreB: 12,
    playedAt: timestamp(daysAgo, 20, 8),
    reportedBy: pick(present),
  });
  const finalMatch = match({
    id: `m-${tournamentId}-3`,
    tournamentId,
    sessionId,
    phase: 'final',
    teamAId: semiA.winnerId!,
    teamBId: semiB.winnerId!,
    scoreA: random() > 0.45 ? 12 : 7 + Math.floor(random() * 5),
    scoreB: 12,
    playedAt: timestamp(daysAgo, 20, 40),
    reportedBy: pick(present),
  });
  const thirdPlace = match({
    id: `m-${tournamentId}-4`,
    tournamentId,
    sessionId,
    phase: 'third-place',
    teamAId: semiA.loserId!,
    teamBId: semiB.loserId!,
    scoreA: 12,
    scoreB: 8 + Math.floor(random() * 4),
    playedAt: timestamp(daysAgo, 20, 25),
    reportedBy: pick(present),
  });
  const matches = [semiA, semiB, thirdPlace, finalMatch];

  const tournament = baseTournament({
    id: tournamentId,
    sessionId,
    name: HISTORY_NAMES[index % HISTORY_NAMES.length],
    drawId: selectedDraw.id,
    formatId: 'knockout-4',
    teams,
    thirdPlaceEnabled: true,
    matches: matches.map((entry) => entry.id),
    finalStandings: [
      { teamId: finalMatch.winnerId!, position: 1 },
      { teamId: finalMatch.loserId!, position: 2 },
      { teamId: thirdPlace.winnerId!, position: 3 },
      { teamId: thirdPlace.loserId!, position: 4 },
    ],
    createdAt: timestamp(daysAgo, 19, 35),
    updatedAt: timestamp(daysAgo, 20, 55),
  });

  draft.sessions.push({
    id: sessionId,
    groupId,
    date,
    playerIds: present,
    drawIds: [selectedDraw.id, ...discarded.map((entry) => entry.id)],
    tournamentIds: [tournamentId],
    createdAt: timestamp(daysAgo, 19, 20),
    updatedAt: timestamp(daysAgo, 20, 55),
  });
  draft.draws.push(selectedDraw, ...discarded);
  draft.tournaments.push(tournament);
  draft.matches.push(...matches);
}

/**
 * A sessão de hoje do Vôlei Segunda: o campeonato 1 finalizado e o campeonato 2
 * ao vivo, exatamente como nas telas do handoff.
 */
function seedTodaySession(draft: Draft): void {
  const sessionId = 's-hoje';

  // ── Campeonato 1 · "Saca ni mim Douglas" · finalizado ───────────────────
  // Avulso: Caio. A rodada 1 é (duplas 1×2) e (3×4); a dupla 5 fica de bye.
  const c1 = 'tn-camp-1';
  const c1Teams = [
    team('t-c1-duda-malu', ['p-duda', 'p-malu']),
    team('t-c1-thiago-nina', ['p-thiago', 'p-nina']),
    team('t-c1-rafa-bia', ['p-rafa', 'p-bia']),
    team('t-c1-leo-carol', ['p-leo', 'p-carol']),
    team('t-c1-gui-paty', ['p-gui', 'p-paty']),
  ];
  // O encaixe desfez Léo + Carol: Léo venceu o par-ou-ímpar e jogou com Caio.
  const c1Encaixe: TournamentTeam = {
    id: 't-c1-leo-caio',
    playerIds: ['p-leo', 'p-caio'],
    eliminated: false,
    eliminatedDirectly: false,
    synthetic: true,
    originalPlayerIds: ['p-leo', 'p-carol'],
  };
  c1Teams[3] = { ...c1Teams[3], eliminated: true };
  c1Teams[1] = { ...c1Teams[1], eliminated: true, eliminatedDirectly: true };

  const c1Draw: DrawProposal = {
    id: 'd-hoje-1',
    sessionId,
    teams: c1Teams.map((entry) => ({ id: entry.id, playerIds: entry.playerIds })),
    waitingPlayerId: 'p-caio',
    score: 100,
    badges: [],
    selected: true,
    createdAt: timestamp(0, 19, 20),
  };

  const c1Matches = [
    match({
      id: 'm-c1-1',
      tournamentId: c1,
      sessionId,
      phase: 'round-1',
      teamAId: 't-c1-duda-malu',
      teamBId: 't-c1-thiago-nina',
      scoreA: 12,
      scoreB: 6,
      playedAt: timestamp(0, 19, 42),
      reportedBy: 'p-duda',
    }),
    match({
      id: 'm-c1-2',
      tournamentId: c1,
      sessionId,
      phase: 'round-1',
      teamAId: 't-c1-rafa-bia',
      teamBId: 't-c1-leo-carol',
      scoreA: 12,
      scoreB: 10,
      playedAt: timestamp(0, 19, 48),
      reportedBy: 'p-bia',
    }),
    match({
      id: 'm-c1-3',
      tournamentId: c1,
      sessionId,
      phase: 'semifinal-bye',
      teamAId: 't-c1-leo-caio',
      teamBId: 't-c1-gui-paty',
      scoreA: 12,
      scoreB: 9,
      playedAt: timestamp(0, 19, 58),
      reportedBy: 'p-caio',
    }),
    match({
      id: 'm-c1-4',
      tournamentId: c1,
      sessionId,
      phase: 'semifinal',
      teamAId: 't-c1-rafa-bia',
      teamBId: 't-c1-leo-caio',
      scoreA: 12,
      scoreB: 10,
      playedAt: timestamp(0, 20, 6),
      reportedBy: 'p-rafa',
    }),
    match({
      id: 'm-c1-5',
      tournamentId: c1,
      sessionId,
      phase: 'final',
      teamAId: 't-c1-duda-malu',
      teamBId: 't-c1-rafa-bia',
      scoreA: 9,
      scoreB: 12,
      playedAt: timestamp(0, 20, 18),
      reportedBy: 'p-nina',
    }),
  ];

  const camp1 = baseTournament({
    id: c1,
    sessionId,
    name: 'Saca ni mim Douglas',
    drawId: c1Draw.id,
    formatId: 'encaixe-5',
    teams: [...c1Teams, c1Encaixe],
    waitingPlayerId: 'p-caio',
    oddPlayerPlacementEnabled: true,
    oddPlayerPlacement: {
      sourceTeamId: 't-c1-leo-carol',
      encaixeTeamId: 't-c1-leo-caio',
      survivingPlayerId: 'p-leo',
      eliminatedPlayerId: 'p-carol',
      decidedBy: 'p-rafa',
      decidedAt: timestamp(0, 19, 53),
    },
    priorityEntries: [
      { playerId: 'p-thiago', reason: 'direct-elimination' },
      { playerId: 'p-nina', reason: 'direct-elimination' },
      { playerId: 'p-carol', reason: 'coin-flip-loss' },
    ],
    matches: c1Matches.map((entry) => entry.id),
    status: 'completed',
    finalStandings: [
      { teamId: 't-c1-rafa-bia', position: 1 },
      { teamId: 't-c1-duda-malu', position: 2 },
      { teamId: 't-c1-leo-caio', position: 3 },
      { teamId: 't-c1-gui-paty', position: 4 },
      { teamId: 't-c1-thiago-nina', position: 5 },
    ],
    createdAt: timestamp(0, 19, 25),
    updatedAt: timestamp(0, 20, 20),
  });

  // ── Campeonato 2 · "Tira o par o ímpar aí" · ao vivo ────────────────────
  // Avulsa: Malu. Rodada 1 jogada, encaixe decidido (Rafa venceu o
  // par-ou-ímpar), e agora está em quadra a semifinal do bye.
  const c2 = 'tn-camp-2';
  const c2Teams = [
    team('t-c2-thiago-nina', ['p-thiago', 'p-nina']),
    { ...team('t-c2-carol-gui', ['p-carol', 'p-gui']), eliminated: true, eliminatedDirectly: true },
    { ...team('t-c2-rafa-paty', ['p-rafa', 'p-paty']), eliminated: true },
    team('t-c2-leo-bia', ['p-leo', 'p-bia']),
    team('t-c2-duda-caio', ['p-duda', 'p-caio']),
  ];
  const c2Encaixe: TournamentTeam = {
    id: 't-c2-rafa-malu',
    playerIds: ['p-rafa', 'p-malu'],
    eliminated: false,
    eliminatedDirectly: false,
    synthetic: true,
    originalPlayerIds: ['p-rafa', 'p-paty'],
  };

  const c2Draw: DrawProposal = {
    id: 'd-hoje-2',
    sessionId,
    teams: c2Teams.map((entry) => ({ id: entry.id, playerIds: entry.playerIds })),
    waitingPlayerId: 'p-malu',
    score: 100,
    badges: [],
    selected: true,
    createdAt: timestamp(0, 20, 24),
  };

  const c2Matches = [
    match({
      id: 'm-c2-1',
      tournamentId: c2,
      sessionId,
      phase: 'round-1',
      teamAId: 't-c2-thiago-nina',
      teamBId: 't-c2-carol-gui',
      scoreA: 12,
      scoreB: 7,
      playedAt: timestamp(0, 20, 12),
      reportedBy: 'p-nina',
    }),
    match({
      id: 'm-c2-2',
      tournamentId: c2,
      sessionId,
      phase: 'round-1',
      teamAId: 't-c2-rafa-paty',
      teamBId: 't-c2-leo-bia',
      scoreA: 10,
      scoreB: 12,
      playedAt: timestamp(0, 20, 20),
      reportedBy: 'p-leo',
    }),
  ];

  const camp2 = baseTournament({
    id: c2,
    sessionId,
    name: 'Tira o par o ímpar aí',
    drawId: c2Draw.id,
    formatId: 'encaixe-5',
    teams: [...c2Teams, c2Encaixe],
    waitingPlayerId: 'p-malu',
    oddPlayerPlacementEnabled: true,
    oddPlayerPlacement: {
      sourceTeamId: 't-c2-rafa-paty',
      encaixeTeamId: 't-c2-rafa-malu',
      survivingPlayerId: 'p-rafa',
      eliminatedPlayerId: 'p-paty',
      decidedBy: 'p-duda',
      decidedAt: timestamp(0, 20, 28),
    },
    priorityEntries: [
      { playerId: 'p-carol', reason: 'direct-elimination' },
      { playerId: 'p-gui', reason: 'direct-elimination' },
      { playerId: 'p-paty', reason: 'coin-flip-loss' },
    ],
    matches: c2Matches.map((entry) => entry.id),
    status: 'in-progress',
    finalStandings: [],
    createdAt: timestamp(0, 20, 24),
    updatedAt: timestamp(0, 20, 28),
  });

  draft.sessions.push({
    id: sessionId,
    groupId: GROUP_SEGUNDA,
    date: dateString(0),
    playerIds: PRESENT_TODAY,
    drawIds: [c1Draw.id, c2Draw.id],
    tournamentIds: [c1, c2],
    createdAt: timestamp(0, 19, 10),
    updatedAt: timestamp(0, 20, 28),
  });
  draft.draws.push(c1Draw, c2Draw);
  draft.tournaments.push(camp1, camp2);
  draft.matches.push(...c1Matches, ...c2Matches);
}

/** Monta o conjunto inicial no formato dos stores do banco. */
function firstGroupOf(playerId: string): string {
  return SEGUNDA_MEMBERS.some(([id]) => id === playerId) ? GROUP_SEGUNDA : GROUP_TRABALHO;
}

export function buildMockData(): Record<string, unknown[]> {
  const draft: Draft = {
    players: [],
    groups: [],
    members: [],
    sessions: [],
    draws: [],
    tournaments: [],
    matches: [],
  };

  // No banco um jogador pertence a UM vôlei. Aqui, seis pessoas estão nos dois
  // — é o que faz o cenário mostrar as duas visões com uma identidade só. Então
  // `groupId` recebe o primeiro vôlei da pessoa, e é a lista de membros que
  // responde "quem joga neste vôlei" no modo demonstração.
  //
  // A diferença existe porque a identidade de mentira é um jogador, e não uma
  // sessão de navegador. Ela some com ela, no ticket 30.
  for (const spec of PLAYER_SPECS) {
    draft.players.push({
      id: spec.id,
      groupId: firstGroupOf(spec.id),
      name: spec.name,
      gender: spec.gender,
      active: spec.active ?? true,
      createdAt: timestamp(200, 10),
      updatedAt: timestamp(200, 10),
    });
  }

  draft.groups.push(
    {
      id: GROUP_SEGUNDA,
      name: 'Vôlei Segunda',
      ownerPlayerId: GROUP_SEGUNDA_OWNER,
      createdAt: timestamp(400, 10),
    },
    {
      id: GROUP_TRABALHO,
      name: 'Vôlei Trabalho',
      ownerPlayerId: GROUP_TRABALHO_OWNER,
      createdAt: timestamp(300, 10),
    },
  );

  for (const [groupId, specs] of [
    [GROUP_SEGUNDA, SEGUNDA_MEMBERS],
    [GROUP_TRABALHO, TRABALHO_MEMBERS],
  ] as const) {
    for (const [playerId, role] of specs) {
      draft.members.push({ id: `${groupId}:${playerId}`, groupId, playerId, role });
    }
  }

  const segundaPool = SEGUNDA_MEMBERS.filter(([playerId]) => {
    const player = draft.players.find((entry) => entry.id === playerId);
    return player?.active;
  }).map(([playerId]) => playerId);

  const trabalhoPool = TRABALHO_MEMBERS.map(([playerId]) => playerId);

  // Histórico: segundas-feiras para trás, mais algumas sessões do Vôlei
  // Trabalho, para os rankings terem volume.
  for (let week = 1; week <= 22; week++) {
    seedPastSession(draft, GROUP_SEGUNDA, segundaPool, week * 7);
  }
  for (const daysAgo of [4, 11, 18]) {
    seedPastSession(draft, GROUP_TRABALHO, trabalhoPool, daysAgo);
  }

  seedTodaySession(draft);

  return {
    [STORES.PLAYERS]: draft.players,
    [STORES.GROUPS]: draft.groups,
    [STORES.GROUP_MEMBERS]: draft.members,
    [STORES.SESSIONS]: draft.sessions,
    [STORES.DRAWS]: draft.draws,
    [STORES.TOURNAMENTS]: draft.tournaments,
    [STORES.MATCHES]: draft.matches,
  };
}
