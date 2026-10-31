import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TournamentService } from './tournament.service';
import { AppFacade } from '../facade/app.facade';
import { Match, MatchPhase, Tournament, TournamentTeam } from '../../shared/models';

function team(id: string, playerIds: [string, string], synthetic = false): TournamentTeam {
  return {
    id,
    playerIds,
    eliminated: false,
    eliminatedDirectly: false,
    synthetic,
    originalPlayerIds: null,
  };
}

function match(
  id: string,
  phase: MatchPhase,
  teamAId: string,
  teamBId: string,
  scoreA: number,
  scoreB: number,
): Match {
  return {
    id,
    tournamentId: 't1',
    sessionId: 's1',
    phase,
    teamAId,
    teamBId,
    scoreA,
    scoreB,
    winnerId: scoreA > scoreB ? teamAId : teamBId,
    loserId: scoreA > scoreB ? teamBId : teamAId,
    pointDifference: Math.abs(scoreA - scoreB),
    playedAt: '2026-10-26T22:12:00.000Z',
    reportedBy: null,
    correctedBy: null,
    correctedAt: null,
    createdAt: '2026-10-26T22:12:00.000Z',
  };
}

function tournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 't1',
    name: 'Campeonato',
    sessionId: 's1',
    drawId: 'd1',
    formatId: 'knockout-5',
    teams: [],
    waitingPlayerId: null,
    oddPlayerPlacementEnabled: false,
    oddPlayerLoserPriorityEnabled: true,
    oddPlayerPlacement: null,
    priorityEntries: [],
    pointLimit: 12,
    thirdPlaceEnabled: false,
    matches: [],
    status: 'in-progress',
    finalStandings: [],
    tiebreakDecisions: [],
    createdAt: '2026-10-26T22:00:00.000Z',
    updatedAt: '2026-10-26T22:00:00.000Z',
    ...overrides,
  };
}

function setup(matches: Match[]): { service: TournamentService; saved: Tournament[] } {
  const saved: Tournament[] = [];
  const facade = {
    getMatchesByTournamentId: async () => matches,
    saveTournament: async (entry: Tournament) => {
      saved.push(structuredClone(entry));
      return entry;
    },
  } as unknown as AppFacade;

  TestBed.configureTestingModule({
    providers: [TournamentService, { provide: AppFacade, useValue: facade }],
  });

  return { service: TestBed.inject(TournamentService), saved };
}

/** Cinco duplas sem avulso: a rodada 1 decide quem sobe e quem sai. */
function fiveTeamRound1() {
  const teams = [
    team('t1', ['rafa', 'bia']),
    team('t2', ['thiago', 'nina']),
    team('t3', ['duda', 'malu']),
    team('t4', ['gui', 'paty']),
    team('t5', ['leo', 'carol']),
  ];
  const matches = [
    match('m1', 'round-1', 't1', 't2', 12, 6),
    match('m2', 'round-1', 't3', 't4', 12, 10),
  ];
  return { teams, matches };
}

describe('TournamentService.getNextMatches', () => {
  it('não altera o campeonato ao ser lida duas vezes (§7.5)', async () => {
    const { teams, matches } = fiveTeamRound1();
    const { service, saved } = setup(matches);
    const entry = tournament({ teams });

    await service.getNextMatches(entry);
    await service.getNextMatches(entry);

    expect(saved).toHaveLength(0);
    expect(entry.teams.some((candidate) => candidate.eliminatedDirectly)).toBe(false);
    expect(entry.priorityEntries).toHaveLength(0);
  });

  it('gera a semifinal do bye depois da rodada 1', async () => {
    const { teams, matches } = fiveTeamRound1();
    const { service } = setup(matches);

    const next = await service.getNextMatches(tournament({ teams }));

    expect(next).toEqual([{ phase: 'semifinal-bye', teamAId: 't3', teamBId: 't5' }]);
  });

  it('pausa a chave enquanto o empate de diferença não for resolvido (§9.3)', async () => {
    const teams = [
      team('t1', ['rafa', 'bia']),
      team('t2', ['thiago', 'nina']),
      team('t3', ['duda', 'malu']),
      team('t4', ['gui', 'paty']),
      team('t5', ['leo', 'carol']),
    ];
    // As duas partidas terminam com a mesma diferença: não há critério.
    const matches = [
      match('m1', 'round-1', 't1', 't2', 12, 9),
      match('m2', 'round-1', 't3', 't4', 11, 8),
    ];
    const { service } = setup(matches);
    const entry = tournament({ teams });

    expect(service.pendingTiebreak(entry, matches)).toEqual({
      kind: 'losers',
      teamIds: ['t2', 't4'],
    });
    expect(await service.getNextMatches(entry)).toEqual([]);
  });

  it('volta a gerar partida depois das decisões registradas', async () => {
    const teams = [
      team('t1', ['rafa', 'bia']),
      team('t2', ['thiago', 'nina']),
      team('t3', ['duda', 'malu']),
      team('t4', ['gui', 'paty']),
      team('t5', ['leo', 'carol']),
    ];
    const matches = [
      match('m1', 'round-1', 't1', 't2', 12, 9),
      match('m2', 'round-1', 't3', 't4', 11, 8),
    ];
    const { service } = setup(matches);
    let entry = tournament({ teams });

    entry = await service.recordTiebreak(entry, 'losers', ['t2', 't4'], 't4', 'p-duda');
    entry = await service.recordTiebreak(entry, 'winners', ['t1', 't3'], 't3', 'p-duda');

    expect(service.pendingTiebreak(entry, matches)).toBeNull();
    // t3 venceu o par-ou-ímpar dos vencedores, então vai direto à final e a
    // semifinal do bye é do outro vencedor, t1.
    expect(await service.getNextMatches(entry)).toEqual([
      { phase: 'semifinal-bye', teamAId: 't1', teamBId: 't5' },
    ]);
  });
});

describe('TournamentService.closeRound1', () => {
  it('marca a eliminação direta e a prioridade ao fechar a rodada 1', async () => {
    const { teams, matches } = fiveTeamRound1();
    const { service, saved } = setup(matches);

    const entry = await service.closeRound1(tournament({ teams }), matches);

    const eliminated = entry.teams.find((candidate) => candidate.id === 't2');
    expect(eliminated?.eliminatedDirectly).toBe(true);
    expect(entry.priorityEntries).toEqual([
      { playerId: 'thiago', reason: 'direct-elimination' },
      { playerId: 'nina', reason: 'direct-elimination' },
    ]);
    expect(saved).toHaveLength(1);
  });

  it('não marca nada com a rodada 1 incompleta', async () => {
    const { teams, matches } = fiveTeamRound1();
    const { service, saved } = setup(matches);

    const entry = await service.closeRound1(tournament({ teams }), [matches[0]]);

    expect(entry.teams.some((candidate) => candidate.eliminatedDirectly)).toBe(false);
    expect(saved).toHaveLength(0);
  });

  it('não marca duas vezes', async () => {
    const { teams, matches } = fiveTeamRound1();
    const { service, saved } = setup(matches);

    const first = await service.closeRound1(tournament({ teams }), matches);
    await service.closeRound1(first, matches);

    expect(first.priorityEntries).toHaveLength(2);
    expect(saved).toHaveLength(1);
  });
});

describe('TournamentService.computeFinalStandings', () => {
  it('não repete a dupla desfeita no encaixe (§4.6)', () => {
    // Cenário do campeonato 1 do handoff: Léo + Carol perdeu o par-ou-ímpar,
    // Léo seguiu com o avulso Caio e Carol saiu.
    const teams = [
      team('t-duda-malu', ['duda', 'malu']),
      { ...team('t-thiago-nina', ['thiago', 'nina']), eliminated: true, eliminatedDirectly: true },
      team('t-rafa-bia', ['rafa', 'bia']),
      { ...team('t-leo-carol', ['leo', 'carol']), eliminated: true },
      team('t-gui-paty', ['gui', 'paty']),
      {
        ...team('t-leo-caio', ['leo', 'caio'], true),
        originalPlayerIds: ['leo', 'carol'] as [string, string],
      },
    ];
    const matches = [
      match('m1', 'round-1', 't-duda-malu', 't-thiago-nina', 12, 6),
      match('m2', 'round-1', 't-rafa-bia', 't-leo-carol', 12, 10),
      match('m3', 'semifinal-bye', 't-leo-caio', 't-gui-paty', 12, 9),
      match('m4', 'semifinal', 't-rafa-bia', 't-leo-caio', 12, 10),
      match('m5', 'final', 't-duda-malu', 't-rafa-bia', 9, 12),
    ];

    const { service } = setup(matches);
    const standings = service.computeFinalStandings(
      tournament({
        teams,
        formatId: 'encaixe-5',
        waitingPlayerId: 'caio',
        oddPlayerPlacementEnabled: true,
        oddPlayerPlacement: {
          sourceTeamId: 't-leo-carol',
          encaixeTeamId: 't-leo-caio',
          survivingPlayerId: 'leo',
          eliminatedPlayerId: 'carol',
          decidedBy: 'p-rafa',
          decidedAt: '2026-10-26T22:53:00.000Z',
        },
      }),
      matches,
    );

    expect(standings.map((standing) => standing.teamId)).toEqual([
      't-rafa-bia',
      't-duda-malu',
      't-leo-caio',
      't-gui-paty',
      't-thiago-nina',
    ]);
    expect(standings.map((standing) => standing.position)).toEqual([1, 2, 3, 4, 5]);
    expect(standings.some((standing) => standing.teamId === 't-leo-carol')).toBe(false);
  });
});

describe('TournamentService.closeRound1 depois de uma correção', () => {
  it('muda a eliminação direta quando o placar corrigido inverte a diferença', async () => {
    const { teams } = fiveTeamRound1();
    const original = [
      match('m1', 'round-1', 't1', 't2', 12, 6),
      match('m2', 'round-1', 't3', 't4', 12, 10),
    ];

    const { service } = setup(original);
    const entry = await service.closeRound1(tournament({ teams }), original);

    expect(entry.teams.find((team) => team.id === 't2')?.eliminatedDirectly).toBe(true);

    // Um admin corrige o placar: agora quem perdeu por mais é t4.
    const corrected = [
      match('m1', 'round-1', 't1', 't2', 12, 11),
      match('m2', 'round-1', 't3', 't4', 12, 4),
    ];
    const after = await service.closeRound1(entry, corrected);

    expect(after.teams.find((team) => team.id === 't2')?.eliminatedDirectly).toBe(false);
    expect(after.teams.find((team) => team.id === 't4')?.eliminatedDirectly).toBe(true);
    expect(after.priorityEntries).toEqual([
      { playerId: 'gui', reason: 'direct-elimination' },
      { playerId: 'paty', reason: 'direct-elimination' },
    ]);
  });
});
