import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DrawService } from './draw.service';
import { AppFacade } from '../facade/app.facade';
import { proposalKey } from '../rules/draw-proposals';
import { TournamentService } from './tournament.service';
import { DrawProposal, Match, Player, Tournament, TournamentTeam } from '../../shared/models';
import { Gender } from '../../shared/enums';

const NAMES = [
  'Rafa',
  'Bia',
  'Duda',
  'Léo',
  'Carol',
  'Thiago',
  'Nina',
  'Gui',
  'Paty',
  'Caio',
  'Malu',
];

function players(count: number): Player[] {
  return NAMES.slice(0, count).map((name, index) => ({
    id: `p-${name.toLowerCase()}`,
    groupId: 'g-1',
    name,
    gender: index % 2 === 0 ? Gender.MALE : Gender.FEMALE,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }));
}

/** Fachada só com o que o sorteio lê de uma sessão. */
function facadeStub(
  draws: DrawProposal[] = [],
  tournaments: Tournament[] = [],
  matches: Match[] = [],
  saved: DrawProposal[] = [],
) {
  return {
    getDrawsBySessionId: async () => draws,
    getTournamentsBySessionId: async () => tournaments,
    getMatchesByTournamentId: async (tournamentId: string) =>
      matches.filter((match) => match.tournamentId === tournamentId),
    saveDraw: async (draw: DrawProposal) => {
      saved.push(draw);
      return draw;
    },
  } as unknown as AppFacade;
}

function setup(draws?: DrawProposal[], tournaments?: Tournament[]): DrawService {
  TestBed.configureTestingModule({
    providers: [
      DrawService,
      TournamentService,
      { provide: AppFacade, useValue: facadeStub(draws, tournaments) },
    ],
  });
  return TestBed.inject(DrawService);
}

/** Como `setup`, mas com partidas e um registro do que foi gravado. */
function setupWithMatches(
  draws: DrawProposal[],
  tournaments: Tournament[],
  matches: Match[],
): { service: DrawService; saved: DrawProposal[] } {
  const saved: DrawProposal[] = [];
  // Dois cenários no mesmo teste precisam de dois módulos.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      DrawService,
      TournamentService,
      { provide: AppFacade, useValue: facadeStub(draws, tournaments, matches, saved) },
    ],
  });
  return { service: TestBed.inject(DrawService), saved };
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

function round1(
  id: string,
  teamAId: string,
  teamBId: string,
  scoreA: number,
  scoreB: number,
): Match {
  return {
    id,
    tournamentId: 't1',
    sessionId: 's1',
    phase: 'round-1',
    teamAId,
    teamBId,
    scoreA,
    scoreB,
    winnerId: scoreA > scoreB ? teamAId : teamBId,
    loserId: scoreA > scoreB ? teamBId : teamAId,
    pointDifference: Math.abs(scoreA - scoreB),
    playedAt: '2026-10-31T22:30:00.000Z',
    reportedBy: null,
    correctedBy: null,
    correctedAt: null,
    createdAt: '2026-10-31T22:30:00.000Z',
  };
}

/**
 * Cinco duplas, rodada 1 fechada: `t4` perdeu por mais diferença e está fora.
 *
 * A marca da eliminação direta e a prioridade dela vêm de `closeRound1()`, que
 * roda no caminho de salvar o placar (§7.5) — então um campeonato com a rodada
 * 1 fechada já as tem gravadas, esteja ele em andamento ou encerrado. É isso
 * que a fixture reproduz.
 */
function fiveTeamTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 't1',
    name: 'Campeonato',
    sessionId: 's1',
    drawId: 'd1',
    formatId: 'knockout-5',
    teams: [
      team('t1', ['p-rafa', 'p-bia']),
      team('t2', ['p-thiago', 'p-nina']),
      team('t3', ['p-duda', 'p-malu']),
      { ...team('t4', ['p-gui', 'p-paty']), eliminated: true, eliminatedDirectly: true },
      team('t5', ['p-leo', 'p-carol']),
    ],
    waitingPlayerId: null,
    oddPlayerPlacementEnabled: false,
    oddPlayerLoserPriorityEnabled: true,
    oddPlayerPlacement: null,
    priorityEntries: [
      { playerId: 'p-gui', reason: 'direct-elimination' },
      { playerId: 'p-paty', reason: 'direct-elimination' },
    ],
    pointLimit: 12,
    thirdPlaceEnabled: false,
    matches: ['m1', 'm2'],
    status: 'in-progress',
    finalStandings: [],
    tiebreakDecisions: [],
    createdAt: '2026-10-31T22:00:00.000Z',
    updatedAt: '2026-10-31T22:30:00.000Z',
    ...overrides,
  };
}

const ROUND_1_FECHADA = [round1('m1', 't1', 't2', 12, 6), round1('m2', 't3', 't4', 12, 2)];

describe('DrawService.generateProposals', () => {
  it('gera três propostas distintas, cada uma com um avulso diferente', async () => {
    const service = setup();

    const proposals = await service.generateProposals('s1', players(11), new Set(), []);

    expect(proposals).toHaveLength(3);

    const waiting = proposals.map((proposal) => proposal.waitingPlayerId);
    expect(new Set(waiting).size).toBe(3);

    const keys = proposals.map((proposal) => proposalKey(proposal.teams, proposal.waitingPlayerId));
    expect(new Set(keys).size).toBe(3);
  });

  it('forma cinco duplas e deixa um avulso com 11 presentes', async () => {
    const service = setup();

    const [proposal] = await service.generateProposals('s1', players(11), new Set(), []);

    expect(proposal.teams).toHaveLength(5);
    expect(proposal.waitingPlayerId).not.toBeNull();
    const drawn = proposal.teams.flatMap((team) => team.playerIds);
    expect(drawn).not.toContain(proposal.waitingPlayerId);
    expect(new Set(drawn).size).toBe(10);
  });

  it('com número par não há avulso, e as propostas continuam diferentes', async () => {
    const service = setup();

    const proposals = await service.generateProposals('s1', players(10), new Set(), []);

    expect(proposals.length).toBeGreaterThan(1);
    expect(proposals.every((proposal) => proposal.waitingPlayerId === null)).toBe(true);

    const keys = proposals.map((proposal) => proposalKey(proposal.teams, proposal.waitingPlayerId));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('não escolhe como avulso quem já esperou hoje nem quem tem prioridade', async () => {
    const alreadyWaited: DrawProposal = {
      id: 'd-1',
      sessionId: 's1',
      teams: [],
      waitingPlayerId: 'p-caio',
      score: 100,
      badges: [],
      selected: true,
      createdAt: '2026-10-26T22:00:00.000Z',
    };

    const service = setup([alreadyWaited]);

    const proposals = await service.generateProposals('s1', players(11), new Set(), [
      { playerId: 'p-thiago', reason: 'direct-elimination' },
      { playerId: 'p-nina', reason: 'direct-elimination' },
    ]);

    const waiting = proposals.map((proposal) => proposal.waitingPlayerId);
    expect(waiting).not.toContain('p-caio');
    expect(waiting).not.toContain('p-thiago');
    expect(waiting).not.toContain('p-nina');
  });

  it('marca a primeira proposta como a escolhida e não renderiza pontuação em nenhuma', async () => {
    const service = setup();

    const proposals = await service.generateProposals('s1', players(11), new Set(), []);

    expect(proposals[0].selected).toBe(true);
    expect(proposals.slice(1).every((proposal) => !proposal.selected)).toBe(true);
    // A pontuação continua existindo para ordenar — a tela é que não mostra.
    expect(proposals.every((proposal) => typeof proposal.score === 'number')).toBe(true);
  });
});

describe('DrawService.swapPlayers', () => {
  it('troca dois jogadores de dupla', () => {
    const service = setup();
    const teams = [
      { id: 't1', playerIds: ['p-rafa', 'p-bia'] as [string, string] },
      { id: 't2', playerIds: ['p-gui', 'p-paty'] as [string, string] },
    ];

    const swapped = service.swapPlayers(teams, 'p-bia', 'p-gui');

    expect(swapped[0].playerIds).toEqual(['p-rafa', 'p-gui']);
    expect(swapped[1].playerIds).toEqual(['p-bia', 'p-paty']);
  });
});

describe('DrawService.getPriorityEntries', () => {
  it('lê o campeonato em andamento depois do fecho da rodada 1, igual ao encerrado', async () => {
    const emAndamento = setupWithMatches([], [fiveTeamTournament()], ROUND_1_FECHADA);
    const durante = await emAndamento.service.getPriorityEntries('s1');

    const encerrado = setupWithMatches(
      [],
      [fiveTeamTournament({ status: 'completed' })],
      ROUND_1_FECHADA,
    );
    const depois = await encerrado.service.getPriorityEntries('s1');

    expect(durante).toEqual([
      { playerId: 'p-gui', reason: 'direct-elimination' },
      { playerId: 'p-paty', reason: 'direct-elimination' },
    ]);
    expect(durante).toEqual(depois);
  });

  it('não lê prioridade de campeonato com a rodada 1 em aberto', async () => {
    const { service } = setupWithMatches([], [fiveTeamTournament()], [ROUND_1_FECHADA[0]]);

    // O portão fechado é o que importa: mesmo com prioridade já gravada, ela
    // não vale enquanto a rodada 1 pode mudar.
    expect(await service.getPriorityEntries('s1')).toEqual([]);
  });

  it('não lê prioridade enquanto o par-ou-ímpar do encaixe não foi aplicado', async () => {
    const comEncaixe = fiveTeamTournament({
      waitingPlayerId: 'p-caio',
      oddPlayerPlacementEnabled: true,
    });
    const { service } = setupWithMatches([], [comEncaixe], ROUND_1_FECHADA);

    expect(await service.getPriorityEntries('s1')).toEqual([]);
  });

  it('volta para o campeonato anterior quando o de agora ainda não decidiu nada', async () => {
    const anterior = fiveTeamTournament({
      id: 't0',
      drawId: 'd0',
      status: 'completed',
      priorityEntries: [{ playerId: 'p-leo', reason: 'direct-elimination' }],
      createdAt: '2026-10-31T21:00:00.000Z',
    });
    const agora = fiveTeamTournament({ createdAt: '2026-10-31T22:00:00.000Z' });
    const { service } = setupWithMatches([], [anterior, agora], [ROUND_1_FECHADA[0]]);

    expect(await service.getPriorityEntries('s1')).toEqual([
      { playerId: 'p-leo', reason: 'direct-elimination' },
    ]);
  });
});

describe('DrawService.discardPendingDraw', () => {
  const pendente: DrawProposal = {
    id: 'd-2',
    sessionId: 's1',
    teams: [{ id: 'dt-1', playerIds: ['p-rafa', 'p-bia'] }],
    waitingPlayerId: null,
    score: 100,
    badges: [],
    selected: true,
    createdAt: '2026-10-31T23:00:00.000Z',
  };

  it('tira o sorteio pendente de circulação sem apagar o registro', async () => {
    const { service, saved } = setupWithMatches([pendente], [], []);

    const discarded = await service.discardPendingDraw('s1');

    expect(discarded?.id).toBe('d-2');
    expect(saved).toEqual([{ ...pendente, selected: false }]);
  });

  it('não descarta o sorteio que já virou campeonato', async () => {
    const { service, saved } = setupWithMatches(
      [pendente],
      [fiveTeamTournament({ drawId: 'd-2' })],
      ROUND_1_FECHADA,
    );

    expect(await service.discardPendingDraw('s1')).toBeNull();
    expect(saved).toEqual([]);
  });
});

/**
 * O que a prioridade promete é JOGAR (REGRAS.md §3.3): quem foi prejudicado no
 * campeonato anterior entra na primeira rodada do seguinte. A ordenação das
 * duplas sozinha não entregava isso — três prioritários em três duplas
 * diferentes põem a terceira fora do primeiro jogo, e a promessa vira texto.
 *
 * Os testes de prioridade que existiam olhavam de onde ela VEM (o portão da
 * rodada 1, o avulso que não pode ser prioritário). Nenhum perguntava onde ela
 * CHEGA.
 */
describe('prioritários entram no primeiro jogo', () => {
  /** Em que dupla cada jogador caiu, por proposta. */
  function teamIndexOf(proposal: DrawProposal, playerId: string): number {
    return proposal.teams.findIndex((team) => team.playerIds.includes(playerId));
  }

  it('três prioritários cabem nas duas duplas do primeiro jogo', async () => {
    const service = setup();
    const prioritarios = ['p-rafa', 'p-bia', 'p-duda'];

    const proposals = await service.generateProposals(
      's1',
      players(8),
      new Set(),
      prioritarios.map((playerId) => ({ playerId, reason: 'direct-elimination' as const })),
    );

    expect(proposals.length).toBeGreaterThan(0);
    for (const proposal of proposals) {
      for (const playerId of prioritarios) {
        const dupla = teamIndexOf(proposal, playerId);
        expect(dupla, `${playerId} caiu na dupla ${dupla + 1}`).toBeLessThan(2);
      }
    }
  });

  it('quatro também', async () => {
    const service = setup();
    const prioritarios = ['p-rafa', 'p-bia', 'p-duda', 'p-léo'];

    const proposals = await service.generateProposals(
      's1',
      players(10),
      new Set(),
      prioritarios.map((playerId) => ({ playerId, reason: 'direct-elimination' as const })),
    );

    for (const proposal of proposals) {
      for (const playerId of prioritarios) {
        expect(teamIndexOf(proposal, playerId)).toBeLessThan(2);
      }
    }
  });

  it('dois prioritários não viram uma dupla só: eles abrem o jogo um contra o outro', async () => {
    // Grudar os dois num par resolveria o primeiro jogo e criaria outro
    // problema: a mesma dupla nas 100 tentativas, inclusive quando ela já jogou
    // junta hoje. Com dois, as duas duplas do primeiro jogo já os comportam.
    const service = setup();

    const proposals = await service.generateProposals('s1', players(8), new Set(), [
      { playerId: 'p-rafa', reason: 'direct-elimination' },
      { playerId: 'p-bia', reason: 'direct-elimination' },
    ]);

    for (const proposal of proposals) {
      const duplas = [teamIndexOf(proposal, 'p-rafa'), teamIndexOf(proposal, 'p-bia')].sort();
      expect(duplas).toEqual([0, 1]);
    }
  });

  it('mais prioritários do que o primeiro jogo comporta: ocupam o mínimo de duplas', async () => {
    const service = setup();
    const prioritarios = ['p-rafa', 'p-bia', 'p-duda', 'p-léo', 'p-carol'];

    const proposals = await service.generateProposals(
      's1',
      players(10),
      new Set(),
      prioritarios.map((playerId) => ({ playerId, reason: 'direct-elimination' as const })),
    );

    for (const proposal of proposals) {
      const duplas = new Set(prioritarios.map((playerId) => teamIndexOf(proposal, playerId)));
      // Cinco pessoas não cabem em duas duplas; em três, cabem — e são as três
      // primeiras do chaveamento.
      expect(duplas.size).toBe(3);
      expect(Math.max(...duplas)).toBe(2);
    }
  });

  it('o sorteio continua sorteio: com um prioritário, o resto varia', async () => {
    const service = setup();

    const proposals = await service.generateProposals('s1', players(10), new Set(), [
      { playerId: 'p-rafa', reason: 'direct-elimination' },
    ]);

    for (const proposal of proposals) {
      expect(teamIndexOf(proposal, 'p-rafa')).toBe(0);
    }

    const parceiros = new Set(
      proposals.map((proposal) => proposal.teams[0].playerIds.find((id) => id !== 'p-rafa')),
    );
    expect(parceiros.size, 'as propostas não podem ser a mesma dupla três vezes').toBeGreaterThan(
      1,
    );
  });
});
