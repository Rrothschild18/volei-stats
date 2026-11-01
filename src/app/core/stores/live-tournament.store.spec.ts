import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LiveTournamentStore } from './live-tournament.store';
import { CurrentGroupStore } from './current-group.store';
import { AppFacade } from '../facade/app.facade';
import { DrawService } from '../services/draw.service';
import { TournamentService } from '../services/tournament.service';
import { Match, MatchPhase, Player, Tournament, TournamentTeam } from '../../shared/models';
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
  const savedMatches: Match[] = [];

  const facade = {
    getTournamentById: async () => tournament(),
    getMatchesByTournamentId: async () => matches,
    getMatchById: async (id: string) => matches.find((entry) => entry.id === id),
    getPlayers: async () => [player('rafa'), player('bia'), player('leo'), player('duda')],
    saveMatch: async (entry: Match) => {
      savedMatches.push(entry);
      return entry;
    },
    saveTournament: async (entry: Tournament) => entry,
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

  return { store, savedMatches, setMatches };
}

describe('LiveTournamentStore.correctScore e o prazo', () => {
  afterEach(() => vi.useRealTimers());

  it('dentro dos 30 min depois da final, a correção é gravada', async () => {
    const { store, savedMatches } = setup('2026-10-27T00:05:00.000Z');
    const result = await store.correctScore('m-final', 12, 9, 'rafa');

    expect(result.saved).toBe(true);
    expect(savedMatches).toHaveLength(1);
    expect(savedMatches[0].scoreB).toBe(9);
    expect(savedMatches[0].correctedBy).toBe('rafa');
  });

  it('31 min depois do fim, a store recusa — e não grava nada', async () => {
    const { store, savedMatches } = setup('2026-10-27T00:11:00.000Z');
    const result = await store.correctScore('m-final', 12, 9, 'rafa');

    expect(result).toEqual({ saved: false, refusal: 'window-closed' });
    expect(savedMatches).toEqual([]);
  });

  it('duas semanas depois, idem: o campeonato já virou ranking de todo mundo', async () => {
    const { store, savedMatches } = setup('2026-11-09T20:00:00.000Z');
    expect(store.correctionOpen()).toBe(false);
    expect((await store.correctScore('m-final', 12, 9, 'rafa')).saved).toBe(false);
    expect(savedMatches).toEqual([]);
  });

  it('sem final lançada, corrigir vale sem prazo: o campeonato está rolando', async () => {
    const { store, savedMatches, setMatches } = setup('2026-11-09T20:00:00.000Z');
    setMatches([match('m-semi', 'semifinal', '2026-10-26T23:00:00.000Z')]);

    expect(store.correctionOpen()).toBe(true);
    expect((await store.correctScore('m-semi', 12, 9, 'rafa')).saved).toBe(true);
    expect(savedMatches).toHaveLength(1);
  });
});
