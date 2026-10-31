import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { StatisticsService } from './statistics.service';
import { MatchRepository } from '../repositories/match.repository';
import { PlayerRepository } from '../repositories/player.repository';
import { TournamentRepository } from '../repositories/tournament.repository';
import { DrawRepository } from '../repositories/draw.repository';
import { DrawProposal, Match, Player, Tournament } from '../../shared/models';
import { Gender } from '../../shared/enums';

function player(id: string, name: string): Player {
  return {
    id,
    name,
    gender: Gender.MALE,
    birthDate: null,
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
