import { describe, expect, it } from 'vitest';
import { destaquesDoGrupo } from './group-highlights';
import { Match, Tournament } from '../../shared/models';

const A = 'a';
const B = 'b';

/** Um campeonato por noite, com Douglas+Wily (A) contra Laura+Raul (B). */
function campeonato(sessionId: string, campea: string | null = A): Tournament {
  return {
    id: `t-${sessionId}`,
    sessionId,
    status: campea ? 'completed' : 'in-progress',
    finalStandings: campea ? [{ teamId: `${sessionId}-${campea}`, position: 1 }] : [],
    teams: [
      { id: `${sessionId}-${A}`, playerIds: ['douglas', 'wily'] },
      { id: `${sessionId}-${B}`, playerIds: ['laura', 'raul'] },
    ],
  } as unknown as Tournament;
}

function partida(
  sessionId: string,
  vencedora: string,
  playedAt: string,
  placar: [number, number] = [12, 8],
): Match {
  const teamAId = `${sessionId}-${A}`;
  const teamBId = `${sessionId}-${B}`;
  const aVenceu = vencedora === A;
  return {
    id: `${sessionId}-${playedAt}`,
    tournamentId: `t-${sessionId}`,
    sessionId,
    teamAId,
    teamBId,
    scoreA: aVenceu ? placar[0] : placar[1],
    scoreB: aVenceu ? placar[1] : placar[0],
    winnerId: aVenceu ? teamAId : teamBId,
    loserId: aVenceu ? teamBId : teamAId,
    pointDifference: placar[0] - placar[1],
    playedAt,
  } as unknown as Match;
}

describe('destaquesDoGrupo', () => {
  it('vitórias e pontos contam só as noites da janela', () => {
    const destaques = destaquesDoGrupo({
      tournaments: [campeonato('s1'), campeonato('s2')],
      matches: [
        partida('s1', B, '2026-11-09T22:00:00Z'),
        partida('s1', B, '2026-11-09T22:10:00Z'),
        partida('s2', A, '2026-11-16T22:00:00Z'),
      ],
      janela: new Set(['s2']),
    });

    expect(destaques.maisVitorias).toEqual({ playerIds: ['douglas', 'wily'], valor: 1 });
    expect(destaques.maisPontos).toEqual({ playerIds: ['douglas', 'wily'], valor: 12 });
  });

  it('a sequência viva atravessa noites e conta até o último jogo', () => {
    const destaques = destaquesDoGrupo({
      tournaments: [campeonato('s1'), campeonato('s2')],
      matches: [
        partida('s1', A, '2026-11-09T22:00:00Z'),
        partida('s1', A, '2026-11-09T22:10:00Z'),
        partida('s2', A, '2026-11-16T22:00:00Z'),
      ],
      janela: null,
    });

    expect(destaques.emSequencia).toEqual({ playerIds: ['douglas', 'wily'], valor: 3 });
  });

  it('quem não veio na última noite não fica "em sequência"', () => {
    // Na noite s2 jogam outras duas duplas: Douglas e Wily não vieram.
    const outraNoite = {
      id: 't-s2',
      sessionId: 's2',
      status: 'completed',
      finalStandings: [],
      teams: [
        { id: 's2-a', playerIds: ['kaio', 'be'] },
        { id: 's2-b', playerIds: ['laura', 'raul'] },
      ],
    } as unknown as Tournament;

    const destaques = destaquesDoGrupo({
      tournaments: [campeonato('s1'), outraNoite],
      matches: [
        partida('s1', A, '2026-11-09T22:00:00Z'),
        partida('s1', A, '2026-11-09T22:10:00Z'),
        partida('s1', A, '2026-11-09T22:20:00Z'),
        partida('s2', B, '2026-11-16T22:00:00Z'),
      ],
      janela: null,
    });

    // As 3 seguidas de Douglas e Wily são recorde, mas não são de AGORA.
    expect(destaques.emSequencia).toBeNull();
    expect(destaques.recordeDeSequencia).toEqual({ playerIds: ['douglas', 'wily'], valor: 3 });
  });

  it('dupla do coração e clássico são de todos os tempos, mesmo com janela', () => {
    const destaques = destaquesDoGrupo({
      tournaments: [campeonato('s1'), campeonato('s2')],
      matches: [partida('s1', A, '2026-11-09T22:00:00Z'), partida('s2', A, '2026-11-16T22:00:00Z')],
      janela: new Set(['s2']),
    });

    expect(destaques.duplaDoCoracao).toEqual({ playerIds: ['douglas', 'wily'], jogos: 2 });
    expect(destaques.classico).toEqual({ playerIds: ['douglas', 'laura'], jogos: 2 });
  });

  it('título só conta campeonato concluído', () => {
    const destaques = destaquesDoGrupo({
      tournaments: [campeonato('s1', null)],
      matches: [partida('s1', A, '2026-11-09T22:00:00Z')],
      janela: null,
    });

    expect(destaques.maisTitulos).toBeNull();
  });

  it('os recordes de partida: o mais elástico e o mais disputado', () => {
    const destaques = destaquesDoGrupo({
      tournaments: [campeonato('s1')],
      matches: [
        partida('s1', A, '2026-11-09T22:00:00Z', [12, 3]),
        partida('s1', B, '2026-11-09T22:10:00Z', [15, 13]),
      ],
      janela: null,
    });

    expect(destaques.maisElastico?.placar).toEqual({ vencedor: 12, perdedor: 3 });
    expect(destaques.maisDisputado?.placar).toEqual({ vencedor: 15, perdedor: 13 });
  });

  it('vôlei sem jogo não tem destaque nenhum', () => {
    const destaques = destaquesDoGrupo({ tournaments: [], matches: [], janela: null });

    expect(destaques.maisVitorias).toBeNull();
    expect(destaques.duplaDoCoracao).toBeNull();
    expect(destaques.maisElastico).toBeNull();
  });
});
