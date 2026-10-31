import { describe, expect, it } from 'vitest';
import { teamStates } from './team-state';
import { Match, MatchPhase, TournamentTeam } from '../../shared/models';

function team(id: string, extra: Partial<TournamentTeam> = {}): TournamentTeam {
  return {
    id,
    playerIds: [`${id}-a`, `${id}-b`],
    eliminated: false,
    eliminatedDirectly: false,
    synthetic: false,
    originalPlayerIds: null,
    ...extra,
  };
}

function match(phase: MatchPhase, vencedora: string, perdedora: string): Match {
  return {
    id: `${phase}-${vencedora}`,
    tournamentId: 't',
    sessionId: 's',
    phase,
    teamAId: vencedora,
    teamBId: perdedora,
    scoreA: 12,
    scoreB: 7,
    winnerId: vencedora,
    loserId: perdedora,
    pointDifference: 5,
    playedAt: '2026-10-31T22:00:00.000Z',
    reportedBy: null,
    correctedBy: null,
    correctedAt: null,
    createdAt: '2026-10-31T22:00:00.000Z',
  };
}

/**
 * O estado de cada dupla sai das PARTIDAS, não de uma marca guardada.
 *
 * A marca `eliminated` só era escrita na eliminação direta e na dupla desfeita
 * pelo encaixe — perder uma partida não marcava ninguém. O resultado é que a
 * aba Duplas dizia "em jogo" para a campeã, para a vice e para quem tinha
 * caído, para sempre.
 */
describe('teamStates', () => {
  const duplas = [team('ta'), team('tb'), team('tc'), team('td'), team('te')];

  it('sem partida nenhuma, todas estão em jogo', () => {
    const estados = teamStates(duplas, [], null);

    expect([...estados.values()]).toEqual(Array(5).fill('em-jogo'));
  });

  it('quem perde uma partida sai do "em jogo"', () => {
    const estados = teamStates(duplas, [match('round-1', 'ta', 'tb')], null);

    expect(estados.get('tb')).toBe('fora');
    expect(estados.get('ta')).toBe('em-jogo');
  });

  it('quem perde a semifinal do bye também sai — era o caso que faltava', () => {
    const estados = teamStates(duplas, [match('semifinal-bye', 'tc', 'te')], null);

    expect(estados.get('te')).toBe('fora');
  });

  it('a final decide campeã e vice, e nenhuma das duas fica "em jogo"', () => {
    const estados = teamStates(duplas, [match('final', 'ta', 'tc')], null);

    expect(estados.get('ta')).toBe('campea');
    expect(estados.get('tc')).toBe('vice');
  });

  it('a eliminação direta tem estado próprio, e vence o "fora"', () => {
    const comMarca = [team('ta'), team('tb', { eliminated: true, eliminatedDirectly: true })];
    const estados = teamStates(comMarca, [match('round-1', 'ta', 'tb')], null);

    expect(estados.get('tb')).toBe('eliminada-direto');
  });

  it('a dupla desfeita no encaixe não é "fora": ela virou outra dupla', () => {
    const estados = teamStates(duplas, [match('round-1', 'ta', 'tb')], {
      sourceTeamId: 'tb',
      encaixeTeamId: 'tz',
      survivingPlayerId: 'tb-a',
      eliminatedPlayerId: 'tb-b',
      decidedBy: null,
      decidedAt: null,
    });

    expect(estados.get('tb')).toBe('desfeita');
  });

  it('perder o 3º lugar é estar fora, não ser vice', () => {
    const estados = teamStates(duplas, [match('third-place', 'tb', 'td')], null);

    expect(estados.get('td')).toBe('fora');
    expect(estados.get('tb')).toBe('fora');
  });
});
