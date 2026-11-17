import { describe, expect, it } from 'vitest';
import { historicoDoConfronto } from './matchup-stats';
import { Match, Tournament } from '../../shared/models';

function campeonato(id: string, duplas: Record<string, [string, string]>): Tournament {
  return {
    id,
    teams: Object.entries(duplas).map(([teamId, playerIds]) => ({ id: teamId, playerIds })),
  } as unknown as Tournament;
}

function partida(teamAId: string, teamBId: string, scoreA: number, scoreB: number): Match {
  return {
    id: `${teamAId}-${teamBId}`,
    teamAId,
    teamBId,
    scoreA,
    scoreB,
    winnerId: scoreA > scoreB ? teamAId : teamBId,
  } as unknown as Match;
}

describe('historicoDoConfronto', () => {
  // Duas noites. Na primeira, Douglas+Wily vencem Laura+Raul. Na segunda, as
  // duplas são outras: Douglas+Laura perdem para Wily+Raul.
  const tournaments = [
    campeonato('n1', { 'n1-a': ['douglas', 'wily'], 'n1-b': ['laura', 'raul'] }),
    campeonato('n2', { 'n2-a': ['laura', 'douglas'], 'n2-b': ['raul', 'wily'] }),
  ];
  const matches = [partida('n1-a', 'n1-b', 12, 8), partida('n2-a', 'n2-b', 10, 12)];

  it('conta os jogos da dupla pelo PAR, em qualquer ordem e em qualquer noite', () => {
    const historico = historicoDoConfronto({
      matches,
      tournaments,
      teamA: ['wily', 'douglas'],
      teamB: ['raul', 'laura'],
    });

    expect(historico.duplaA).toEqual({ jogos: 1, vitorias: 1, mediaPro: 12, mediaContra: 8 });
    expect(historico.duplaB).toEqual({ jogos: 1, vitorias: 0, mediaPro: 8, mediaContra: 12 });
  });

  it('conta quantas vezes ESTAS duas duplas se enfrentaram, e quem levou', () => {
    const historico = historicoDoConfronto({
      matches,
      tournaments,
      teamA: ['douglas', 'wily'],
      teamB: ['laura', 'raul'],
    });

    expect(historico.confrontos).toBe(1);
    expect(historico.vitoriasDeA).toBe(1);
    expect(historico.vitoriasDeB).toBe(0);
  });

  it('dupla que nunca jogou junta vem zerada, sem média inventada', () => {
    const historico = historicoDoConfronto({
      matches,
      tournaments,
      teamA: ['douglas', 'raul'],
      teamB: ['wily', 'laura'],
    });

    expect(historico.duplaA).toEqual({ jogos: 0, vitorias: 0, mediaPro: null, mediaContra: null });
    expect(historico.confrontos).toBe(0);
  });

  it('cruza jogador com jogador que já esteve do outro lado', () => {
    const historico = historicoDoConfronto({
      matches,
      tournaments,
      teamA: ['douglas', 'raul'],
      teamB: ['wily', 'laura'],
    });

    // Douglas × Wily: juntos na noite 1 (não conta), opostos na noite 2 — e o
    // Wily venceu. Douglas × Laura: opostos na noite 1, Douglas venceu.
    expect(historico.cruzamentos).toContainEqual({
      playerA: 'douglas',
      playerB: 'wily',
      jogos: 1,
      vitoriasDeA: 0,
    });
    expect(historico.cruzamentos).toContainEqual({
      playerA: 'douglas',
      playerB: 'laura',
      jogos: 1,
      vitoriasDeA: 1,
    });
  });
});
