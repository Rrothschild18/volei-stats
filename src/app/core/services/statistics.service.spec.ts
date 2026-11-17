import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { StatisticsService } from './statistics.service';
import {
  DrawRepository,
  MatchRepository,
  PlayerRepository,
  TournamentRepository,
} from '../repositories';
import { DrawProposal, Match, Player, Tournament } from '../../shared/models';
import { Gender } from '../../shared/enums';

function player(id: string, name: string): Player {
  return {
    id,
    groupId: 'g-1',
    name,
    gender: Gender.MALE,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const PLAYERS = [player('caio', 'Caio'), player('malu', 'Malu'), player('rafa', 'Rafa')];

function draw(id: string, selected: boolean, waitingPlayerId: string | null): DrawProposal {
  return {
    id,
    sessionId: 's1',
    teams: [],
    waitingPlayerId,
    score: 100,
    badges: [],
    selected,
    createdAt: '2026-10-26T22:00:00.000Z',
  };
}

function tournamentWith(drawId: string, waitingPlayerId: string | null): Tournament {
  return {
    id: `t-${drawId}`,
    name: 'Campeonato',
    sessionId: 's1',
    drawId,
    formatId: 'encaixe-5',
    teams: [
      {
        id: 'team-1',
        playerIds: ['caio', 'rafa'],
        eliminated: false,
        eliminatedDirectly: false,
        synthetic: false,
        originalPlayerIds: null,
      },
    ],
    waitingPlayerId,
    oddPlayerPlacementEnabled: true,
    oddPlayerLoserPriorityEnabled: true,
    oddPlayerPlacement: null,
    priorityEntries: [],
    pointLimit: 12,
    thirdPlaceEnabled: false,
    matches: [],
    status: 'completed',
    finalStandings: [],
    tiebreakDecisions: [],
    createdAt: '2026-10-26T22:00:00.000Z',
    updatedAt: '2026-10-26T22:00:00.000Z',
  };
}

function setup(draws: DrawProposal[], tournaments: Tournament[], matches: Match[] = []) {
  TestBed.configureTestingModule({
    providers: [
      StatisticsService,
      { provide: PlayerRepository, useValue: { getAll: async () => PLAYERS } },
      { provide: MatchRepository, useValue: { getAll: async () => matches } },
      { provide: TournamentRepository, useValue: { getAll: async () => tournaments } },
      { provide: DrawRepository, useValue: { getAll: async () => draws } },
    ],
  });
  return TestBed.inject(StatisticsService);
}

describe('StatisticsService — espera e sorteios (§7.6)', () => {
  it('não conta as propostas descartadas como espera', async () => {
    const service = setup(
      [draw('d1', true, 'caio'), draw('d2', false, 'malu'), draw('d3', false, 'rafa')],
      [],
    );

    const stats = await service.getAllPlayerStats({ includeWithoutGames: true });

    expect(stats.find((entry) => entry.playerId === 'caio')?.timesWaited).toBe(1);
    expect(stats.find((entry) => entry.playerId === 'malu')?.timesWaited).toBe(0);
    expect(stats.find((entry) => entry.playerId === 'rafa')?.timesWaited).toBe(0);
  });

  it('não conta duas vezes a espera do sorteio e do campeonato que nasceu dele', async () => {
    const service = setup([draw('d1', true, 'caio')], [tournamentWith('d1', 'caio')]);

    const stats = await service.getAllPlayerStats({ includeWithoutGames: true });

    expect(stats.find((entry) => entry.playerId === 'caio')?.timesWaited).toBe(1);
  });

  it('conta como sorteio realizado só o escolhido', async () => {
    const service = setup(
      [draw('d1', true, 'caio'), draw('d2', false, null), draw('d3', false, null)],
      [],
    );

    const dashboard = await service.getDashboardData();

    expect(dashboard.totalDraws).toBe(1);
  });
});

describe('StatisticsService — recorte por grupo', () => {
  it('conta só as sessões e os jogadores do grupo', async () => {
    const service = setup(
      [
        draw('d1', true, 'caio'),
        // Sorteio de outra sessão: fora do recorte deste grupo.
        { ...draw('d2', true, 'malu'), sessionId: 's2' },
      ],
      [tournamentWith('d1', 'caio'), { ...tournamentWith('d2', 'malu'), sessionId: 's2' }],
    );

    const scope = {
      sessionIds: new Set(['s1']),
      playerIds: new Set(['caio', 'rafa']),
    };

    const stats = await service.getAllPlayerStats({ includeWithoutGames: true, scope });

    expect(stats.map((entry) => entry.playerId).sort()).toEqual(['caio', 'rafa']);
    // A espera da Malu é de outra sessão, e ela nem é do grupo.
    expect(stats.find((entry) => entry.playerId === 'caio')?.timesWaited).toBe(1);

    const dashboard = await service.getDashboardData(scope);
    expect(dashboard.totalDraws).toBe(1);
  });
});

function match(id: string, sessionId: string, winner: 'a' | 'b'): Match {
  return {
    id,
    tournamentId: 't-d1',
    sessionId,
    phase: 'final',
    teamAId: 'team-1',
    teamBId: 'team-2',
    scoreA: winner === 'a' ? 12 : 7,
    scoreB: winner === 'a' ? 7 : 12,
    winnerId: winner === 'a' ? 'team-1' : 'team-2',
    loserId: winner === 'a' ? 'team-2' : 'team-1',
    pointDifference: 5,
    playedAt: '2026-10-26T22:30:00.000Z',
    reportedBy: null,
    correctedBy: null,
    correctedAt: null,
    coinWinnerTeamId: null,
    coinCallerPlayerId: null,
    coinChoice: null,
    teamASide: null,
    firstServerTeamId: null,
    rallyLog: null,
    createdAt: '2026-10-26T22:30:00.000Z',
  };
}

/** O mesmo campeonato com as duas duplas, em uma noite escolhida. */
function tournamentNaNoite(id: string, sessionId: string): Tournament {
  return {
    ...tournamentWith('d1', null),
    id,
    sessionId,
    teams: [
      {
        id: 'team-1',
        playerIds: ['caio', 'rafa'],
        eliminated: false,
        eliminatedDirectly: false,
        synthetic: false,
        originalPlayerIds: null,
      },
      {
        id: 'team-2',
        playerIds: ['malu', 'caio'],
        eliminated: false,
        eliminatedDirectly: false,
        synthetic: false,
        originalPlayerIds: null,
      },
    ],
  };
}

describe('StatisticsService — a conta por noite (ticket 04)', () => {
  it('dá uma linha por noite, com a vitória na noite certa', async () => {
    const service = setup(
      [],
      [tournamentNaNoite('t-n1', 's1'), tournamentNaNoite('t-n2', 's2')],
      [match('m1', 's1', 'a'), match('m2', 's2', 'b')],
    );

    const rows = await service.getPlayerSessionStats();
    const rafa = rows.filter((row) => row.playerId === 'rafa');

    expect(rafa).toHaveLength(2);
    expect(rafa.find((row) => row.sessionId === 's1')).toMatchObject({ wins: 1, losses: 0 });
    expect(rafa.find((row) => row.sessionId === 's2')).toMatchObject({ wins: 0, losses: 1 });
  });

  it('a soma das noites bate com o total de todos os tempos', async () => {
    const service = setup(
      [draw('d1', true, 'malu')],
      [tournamentNaNoite('t-n1', 's1'), tournamentNaNoite('t-n2', 's2')],
      [match('m1', 's1', 'a'), match('m2', 's2', 'b')],
    );

    const [porNoite, total] = await Promise.all([
      service.getPlayerSessionStats(),
      service.getAllPlayerStats({ includeWithoutGames: true }),
    ]);

    for (const entry of total) {
      const noites = porNoite.filter((row) => row.playerId === entry.playerId);
      const jogos = noites.reduce((soma, row) => soma + row.gamesPlayed, 0);
      const esperas = noites.reduce((soma, row) => soma + row.timesWaited, 0);

      expect(jogos).toBe(entry.gamesPlayed);
      expect(esperas).toBe(entry.timesWaited);
    }
  });

  it('a mesma dupla em noites diferentes vem em linhas separadas', async () => {
    const service = setup(
      [],
      [tournamentNaNoite('t-n1', 's1'), tournamentNaNoite('t-n2', 's2')],
      [match('m1', 's1', 'a'), match('m2', 's2', 'a')],
    );

    const rows = await service.getTeamSessionStats();
    const caioRafa = rows.filter((row) => row.playerIds.join('|') === 'caio|rafa');

    expect(caioRafa.map((row) => row.sessionId).sort()).toEqual(['s1', 's2']);
    expect(caioRafa.every((row) => row.wins === 1)).toBe(true);
  });
});
