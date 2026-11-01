import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LiveTournamentStore } from './live-tournament.store';
import { CurrentGroupStore } from './current-group.store';
import { AppFacade } from '../facade/app.facade';
import { DrawService } from '../services/draw.service';
import { TournamentService } from '../services/tournament.service';
import { Match, MatchPhase, Player, Tournament, TournamentTeam } from '../../shared/models';
import { ScoreCorrection } from '../repositories';
import { Gender } from '../../shared/enums';

/**
 * O prazo de correção, visto de onde ele tem de valer de verdade.
 *
 * A tela já esconde o botão passado o prazo, e isso não basta: a mesma correção
 * chega por aba aberta desde ontem e por link antigo. Se a tela é a única
 * guardiã, o estado errado entra por outro caminho — a lição do ticket 32,
 * aplicada ao ticket 35.
 */

const FIM_DA_FINAL = '2026-10-26T23:40:00.000Z';

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

function match(id: string, phase: MatchPhase, playedAt: string): Match {
  return {
    id,
    tournamentId: 't1',
    sessionId: 's1',
    phase,
    teamAId: 'ta',
    teamBId: 'tb',
    scoreA: 12,
    scoreB: 7,
    winnerId: 'ta',
    loserId: 'tb',
    pointDifference: 5,
    playedAt,
    reportedBy: null,
    correctedBy: null,
    correctedAt: null,
    createdAt: playedAt,
  };
}

function player(id: string): Player {
  return {
    id,
    groupId: 'g1',
    name: id,
    gender: Gender.MALE,
    active: true,
    createdAt: '2026-10-26T22:00:00.000Z',
    updatedAt: '2026-10-26T22:00:00.000Z',
  };
}

function tournament(): Tournament {
  return {
    id: 't1',
    name: 'Campeonato',
    sessionId: 's1',
    drawId: 'd1',
    formatId: 'knockout-4',
    teams: [team('ta', ['rafa', 'bia']), team('tb', ['leo', 'duda'])],
    waitingPlayerId: null,
    oddPlayerPlacementEnabled: false,
    oddPlayerLoserPriorityEnabled: false,
    oddPlayerPlacement: null,
    priorityEntries: [],
    pointLimit: 12,
    thirdPlaceEnabled: false,
    matches: ['m-final'],
    status: 'completed',
    finalStandings: [],
    tiebreakDecisions: [],
    createdAt: '2026-10-26T22:00:00.000Z',
    updatedAt: FIM_DA_FINAL,
  };
}

function setup(agora: string) {
  const matches = [match('m-final', 'final', FIM_DA_FINAL)];
  const corrections: ScoreCorrection[] = [];

  const facade = {
    getTournamentById: async () => tournament(),
    getMatchesByTournamentId: async () => matches,
    getMatchById: async (id: string) => matches.find((entry) => entry.id === id),
    getPlayers: async () => [player('rafa'), player('bia'), player('leo'), player('duda')],
    saveMatch: async (entry: Match) => entry,
    saveTournament: async (entry: Tournament) => entry,
    correctMatchScore: async (correction: ScoreCorrection) => {
      corrections.push(correction);
    },
  } as unknown as AppFacade;

  const draws = { discardPendingDraw: async () => null } as unknown as DrawService;
  const group = { playerId: () => 'rafa' } as unknown as CurrentGroupStore;

  TestBed.configureTestingModule({
    providers: [
      LiveTournamentStore,
      TournamentService,
      { provide: AppFacade, useValue: facade },
      { provide: DrawService, useValue: draws },
      { provide: CurrentGroupStore, useValue: group },
    ],
  });

  const store = TestBed.inject(LiveTournamentStore);
  store.tournament.set(tournament());
  store.matches.set(matches);

  // O relógio do teste: `correctionOpen` compara com `new Date()`.
  vi.useFakeTimers();
  vi.setSystemTime(new Date(agora));

  /** Troca as partidas nos dois lugares: o banco falso e a tela. */
  function setMatches(next: Match[]): void {
    matches.splice(0, matches.length, ...next);
    store.matches.set(next);
  }

  return { store, corrections, setMatches };
}

describe('LiveTournamentStore.correctScore e o prazo', () => {
  afterEach(() => vi.useRealTimers());

  it('dentro dos 30 min depois da final, a correção é gravada', async () => {
    const { store, corrections } = setup('2026-10-27T00:05:00.000Z');
    const result = await store.correctScore('m-final', 12, 9, 'rafa');

    expect(result.saved).toBe(true);
    expect(corrections).toHaveLength(1);
    expect(corrections[0].matchId).toBe('m-final');
    expect(corrections[0].scoreB).toBe(9);
  });

  it('31 min depois do fim, a store recusa — e não grava nada', async () => {
    const { store, corrections } = setup('2026-10-27T00:11:00.000Z');
    const result = await store.correctScore('m-final', 12, 9, 'rafa');

    expect(result).toEqual({ saved: false, refusal: 'window-closed' });
    expect(corrections).toEqual([]);
  });

  it('duas semanas depois, idem: o campeonato já virou ranking de todo mundo', async () => {
    const { store, corrections } = setup('2026-11-09T20:00:00.000Z');
    expect(store.correctionOpen()).toBe(false);
    expect((await store.correctScore('m-final', 12, 9, 'rafa')).saved).toBe(false);
    expect(corrections).toEqual([]);
  });

  it('sem final lançada, corrigir vale sem prazo: o campeonato está rolando', async () => {
    const { store, corrections, setMatches } = setup('2026-11-09T20:00:00.000Z');
    setMatches([match('m-semi', 'semifinal', '2026-10-26T23:00:00.000Z')]);

    expect(store.correctionOpen()).toBe(true);
    expect((await store.correctScore('m-semi', 12, 9, 'rafa')).saved).toBe(true);
    expect(corrections).toHaveLength(1);
  });
});

/**
 * A outra metade do ticket 35, vista de fora: a correção não pode deixar para
 * trás uma final que já não acontece. Aqui o que se verifica é a LIGAÇÃO — que
 * as partidas derrubadas chegam ao banco junto com o placar novo, numa chamada
 * só. Quais são elas é assunto de `TournamentService.obsoleteMatches`.
 */
describe('LiveTournamentStore.correctScore e o que ela derruba', () => {
  afterEach(() => vi.useRealTimers());

  function seisDuplas(): Tournament {
    return {
      ...tournament(),
      formatId: 'knockout-6',
      status: 'completed',
      teams: [
        team('t1', ['rafa', 'bia']),
        team('t2', ['thiago', 'nina']),
        team('t3', ['duda', 'malu']),
        team('t4', ['gui', 'paty']),
        team('t5', ['leo', 'carol']),
        team('t6', ['will', 'be']),
      ],
    };
  }

  function partida(
    id: string,
    phase: MatchPhase,
    teamAId: string,
    teamBId: string,
    scoreA: number,
    scoreB: number,
  ): Match {
    return {
      ...match(id, phase, FIM_DA_FINAL),
      teamAId,
      teamBId,
      scoreA,
      scoreB,
      winnerId: scoreA > scoreB ? teamAId : teamBId,
      loserId: scoreA > scoreB ? teamBId : teamAId,
      pointDifference: Math.abs(scoreA - scoreB),
    };
  }

  it('a final que o resultado novo não produz mais vai junto, na mesma chamada', async () => {
    // t1 vence por 10 e vai direto à final; t3 por 5; t5 por 2.
    const matches = [
      partida('m1', 'round-1', 't1', 't2', 12, 2),
      partida('m2', 'round-1', 't3', 't4', 12, 7),
      partida('m3', 'round-1', 't5', 't6', 12, 10),
      partida('m4', 'semifinal', 't3', 't5', 12, 8),
      partida('m5', 'final', 't1', 't3', 12, 9),
    ];

    const corrections: ScoreCorrection[] = [];
    const campeonato = seisDuplas();

    const facade = {
      getTournamentById: async () => campeonato,
      getMatchesByTournamentId: async () => matches,
      getMatchById: async (id: string) => matches.find((entry) => entry.id === id),
      getPlayers: async () => [],
      saveMatch: async (entry: Match) => entry,
      saveTournament: async (entry: Tournament) => entry,
      correctMatchScore: async (correction: ScoreCorrection) => {
        corrections.push(correction);
      },
    } as unknown as AppFacade;

    TestBed.configureTestingModule({
      providers: [
        LiveTournamentStore,
        TournamentService,
        { provide: AppFacade, useValue: facade },
        { provide: DrawService, useValue: { discardPendingDraw: async () => null } },
        { provide: CurrentGroupStore, useValue: { playerId: () => 'rafa' } },
      ],
    });

    const store = TestBed.inject(LiveTournamentStore);
    store.tournament.set(campeonato);
    store.matches.set(matches);

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27T00:05:00.000Z'));

    // t2 passa a vencer por 10: t1 não vai mais à final, e a final antiga
    // (t1 × t3) foi jogada entre duplas que o resultado novo não manda para lá.
    const result = await store.correctScore('m1', 2, 12, 'rafa');

    expect(corrections).toHaveLength(1);
    expect(corrections[0].matchId).toBe('m1');
    expect(corrections[0].obsoleteMatchIds).toEqual(['m5']);
    expect(corrections[0].dissolvedTeamId).toBeNull();

    // E a tela tem o que dizer.
    expect(result.saved && result.fallout.removedMatches).toBe(1);
    expect(store.correctionFallout()).not.toBeNull();
  });
});
