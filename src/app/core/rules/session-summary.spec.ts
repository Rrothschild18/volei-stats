import { describe, expect, it } from 'vitest';
import { resumoDaSessao } from './session-summary';
import { Match, Tournament } from '../../shared/models';

/** Duas duplas fixas: A = Douglas + Wily, B = Laura + Raul. */
const DUPLA_A = 'team-a';
const DUPLA_B = 'team-b';

function campeonato(id: string, overrides: Partial<Tournament> = {}): Tournament {
  return {
    id,
    name: 'Campeonato',
    sessionId: 's1',
    drawId: `d-${id}`,
    formatId: 'knockout-2',
    teams: [
      {
        id: DUPLA_A,
        playerIds: ['douglas', 'wily'],
        eliminated: false,
        eliminatedDirectly: false,
        synthetic: false,
        originalPlayerIds: null,
      },
      {
        id: DUPLA_B,
        playerIds: ['laura', 'raul'],
        eliminated: false,
        eliminatedDirectly: false,
        synthetic: false,
        originalPlayerIds: null,
      },
    ],
    waitingPlayerId: null,
    oddPlayerPlacementEnabled: false,
    oddPlayerLoserPriorityEnabled: false,
    oddPlayerPlacement: null,
    priorityEntries: [],
    pointLimit: 12,
    thirdPlaceEnabled: false,
    matches: [],
    status: 'completed',
    finalStandings: [
      { teamId: DUPLA_A, position: 1 },
      { teamId: DUPLA_B, position: 2 },
    ],
    tiebreakDecisions: [],
    createdAt: '2026-11-16T22:00:00.000Z',
    updatedAt: '2026-11-16T22:00:00.000Z',
    ...overrides,
  };
}

function partida(
  id: string,
  tournamentId: string,
  vencedora: typeof DUPLA_A | typeof DUPLA_B,
  playedAt: string,
  placar: [number, number] = [12, 7],
): Match {
  return {
    id,
    tournamentId,
    sessionId: 's1',
    phase: 'final',
    teamAId: DUPLA_A,
    teamBId: DUPLA_B,
    scoreA: vencedora === DUPLA_A ? placar[0] : placar[1],
    scoreB: vencedora === DUPLA_A ? placar[1] : placar[0],
    winnerId: vencedora,
    loserId: vencedora === DUPLA_A ? DUPLA_B : DUPLA_A,
    pointDifference: Math.abs(placar[0] - placar[1]),
    playedAt,
    reportedBy: null,
    correctedBy: null,
    correctedAt: null,
    coinWinnerTeamId: null,
    coinCallerPlayerId: null,
    coinChoice: null,
    teamASide: null,
    firstServerTeamId: null,
    createdAt: playedAt,
  };
}

describe('resumoDaSessao', () => {
  it('conta as partidas da noite', () => {
    const resumo = resumoDaSessao({
      tournaments: [campeonato('t1')],
      matches: [
        partida('m1', 't1', DUPLA_A, '2026-11-16T22:10:00.000Z'),
        partida('m2', 't1', DUPLA_B, '2026-11-16T22:20:00.000Z'),
      ],
    });

    expect(resumo.partidas).toBe(2);
  });

  it('aponta quem mais venceu, com os empatados juntos', () => {
    const resumo = resumoDaSessao({
      tournaments: [campeonato('t1')],
      matches: [
        partida('m1', 't1', DUPLA_A, '2026-11-16T22:10:00.000Z'),
        partida('m2', 't1', DUPLA_A, '2026-11-16T22:20:00.000Z'),
        partida('m3', 't1', DUPLA_B, '2026-11-16T22:30:00.000Z'),
      ],
    });

    // Douglas e Wily jogaram juntos: os dois têm 2 vitórias.
    expect(resumo.maisVitorias).toEqual({ playerIds: ['douglas', 'wily'], valor: 2 });
  });

  it('a maior sequência é de vitórias seguidas, na ordem em que os jogos saíram', () => {
    const resumo = resumoDaSessao({
      tournaments: [campeonato('t1')],
      matches: [
        partida('m1', 't1', DUPLA_A, '2026-11-16T22:10:00.000Z'),
        partida('m2', 't1', DUPLA_B, '2026-11-16T22:20:00.000Z'),
        partida('m3', 't1', DUPLA_B, '2026-11-16T22:30:00.000Z'),
        partida('m4', 't1', DUPLA_B, '2026-11-16T22:40:00.000Z'),
      ],
    });

    // Laura e Raul: 3 seguidas depois de perder a primeira.
    expect(resumo.maiorSequencia).toEqual({ playerIds: ['laura', 'raul'], valor: 3 });
  });

  it('empate na sequência traz os dois lados juntos', () => {
    const resumo = resumoDaSessao({
      tournaments: [campeonato('t1')],
      matches: [
        partida('m1', 't1', DUPLA_A, '2026-11-16T22:10:00.000Z'),
        partida('m2', 't1', DUPLA_B, '2026-11-16T22:20:00.000Z'),
      ],
    });

    // Uma vitória para cada dupla: a maior sequência é 1, e é de todo mundo.
    expect(resumo.maiorSequencia).toEqual({
      playerIds: ['douglas', 'laura', 'raul', 'wily'],
      valor: 1,
    });
  });

  it('com uma partida só, a sequência não vira destaque de sequência', () => {
    const resumo = resumoDaSessao({
      tournaments: [campeonato('t1')],
      matches: [partida('m1', 't1', DUPLA_A, '2026-11-16T22:10:00.000Z')],
    });

    expect(resumo.partidas).toBe(1);
    expect(resumo.maiorSequencia?.valor).toBe(1);
    expect(resumo.duracaoMediaMin).toBeNull();
  });

  it('sem partida nenhuma, a noite não inventa destaque', () => {
    const resumo = resumoDaSessao({ tournaments: [], matches: [] });

    expect(resumo.partidas).toBe(0);
    expect(resumo.maisVitorias).toBeNull();
    expect(resumo.maiorSequencia).toBeNull();
  });
});

describe('resumoDaSessao — títulos e pódios', () => {
  it('conta título por campeonato concluído, e os empatados vêm juntos', () => {
    const resumo = resumoDaSessao({
      tournaments: [
        campeonato('t1'),
        campeonato('t2', {
          finalStandings: [
            { teamId: DUPLA_B, position: 1 },
            { teamId: DUPLA_A, position: 2 },
          ],
        }),
      ],
      matches: [
        partida('m1', 't1', DUPLA_A, '2026-11-16T22:10:00.000Z'),
        partida('m2', 't2', DUPLA_B, '2026-11-16T23:10:00.000Z'),
      ],
    });

    expect(resumo.maisTitulos).toEqual({
      playerIds: ['douglas', 'laura', 'raul', 'wily'],
      valor: 1,
    });
  });

  it('pódio é do 1º ao 3º lugar: o 4º fica de fora', () => {
    const quatroDuplas = campeonato('t1', {
      teams: [
        ...campeonato('t1').teams,
        {
          id: 'team-c',
          playerIds: ['kaio', 'be'],
          eliminated: false,
          eliminatedDirectly: false,
          synthetic: false,
          originalPlayerIds: null,
        },
        {
          id: 'team-d',
          playerIds: ['pati', 'eli'],
          eliminated: false,
          eliminatedDirectly: false,
          synthetic: false,
          originalPlayerIds: null,
        },
      ],
      finalStandings: [
        { teamId: DUPLA_A, position: 1 },
        { teamId: DUPLA_B, position: 2 },
        { teamId: 'team-c', position: 3 },
        { teamId: 'team-d', position: 4 },
      ],
    });

    const resumo = resumoDaSessao({
      tournaments: [quatroDuplas],
      matches: [partida('m1', 't1', DUPLA_A, '2026-11-16T22:10:00.000Z')],
    });

    expect(resumo.podios).toEqual([
      { playerId: 'be', valor: 1 },
      { playerId: 'douglas', valor: 1 },
      { playerId: 'kaio', valor: 1 },
      { playerId: 'laura', valor: 1 },
      { playerId: 'raul', valor: 1 },
      { playerId: 'wily', valor: 1 },
    ]);
  });

  it('campeonato em andamento não tem campeão nem título', () => {
    const resumo = resumoDaSessao({
      tournaments: [campeonato('t1', { status: 'in-progress', finalStandings: [] })],
      matches: [partida('m1', 't1', DUPLA_A, '2026-11-16T22:10:00.000Z')],
    });

    expect(resumo.maisTitulos).toBeNull();
    expect(resumo.campeoes).toEqual([]);
  });

  it('cada campeonato concluído entrega campeão e placar da final', () => {
    const resumo = resumoDaSessao({
      tournaments: [campeonato('t1', { name: 'faltou vontade' })],
      matches: [partida('m1', 't1', DUPLA_A, '2026-11-16T22:40:00.000Z', [12, 10])],
    });

    expect(resumo.campeoes).toEqual([
      {
        tournamentId: 't1',
        nome: 'faltou vontade',
        playerIds: ['douglas', 'wily'],
        placar: { vencedor: 12, perdedor: 10 },
      },
    ]);
  });
});

describe('resumoDaSessao — os momentos da noite', () => {
  it('quem fechou a quadra são os jogadores da última partida', () => {
    const resumo = resumoDaSessao({
      tournaments: [campeonato('t1')],
      matches: [
        partida('m1', 't1', DUPLA_A, '2026-11-17T00:10:00.000Z'),
        partida('m2', 't1', DUPLA_B, '2026-11-17T00:58:00.000Z'),
      ],
    });

    expect(resumo.fechouAQuadra).toEqual(['douglas', 'laura', 'raul', 'wily']);
  });

  it('a mais apertada é a de menor diferença', () => {
    const resumo = resumoDaSessao({
      tournaments: [campeonato('t1')],
      matches: [
        partida('m1', 't1', DUPLA_A, '2026-11-16T22:10:00.000Z', [12, 4]),
        partida('m2', 't1', DUPLA_B, '2026-11-16T22:30:00.000Z', [12, 10]),
      ],
    });

    expect(resumo.maisApertada?.matchId).toBe('m2');
    expect(resumo.maisApertada?.diferenca).toBe(2);
  });

  it('a duração média é o intervalo entre placares do mesmo campeonato', () => {
    const resumo = resumoDaSessao({
      tournaments: [campeonato('t1')],
      matches: [
        partida('m1', 't1', DUPLA_A, '2026-11-16T22:00:00.000Z'),
        partida('m2', 't1', DUPLA_B, '2026-11-16T22:08:00.000Z'),
        partida('m3', 't1', DUPLA_A, '2026-11-16T22:20:00.000Z'),
      ],
    });

    // 8 min e 12 min entre os três lançamentos: média 10.
    expect(resumo.duracaoMediaMin).toBe(10);
  });

  it('não mede duração entre campeonatos diferentes', () => {
    const resumo = resumoDaSessao({
      tournaments: [campeonato('t1'), campeonato('t2')],
      matches: [
        partida('m1', 't1', DUPLA_A, '2026-11-16T22:00:00.000Z'),
        // Uma hora depois, outro campeonato: esse intervalo é conversa e água.
        partida('m2', 't2', DUPLA_B, '2026-11-16T23:00:00.000Z'),
      ],
    });

    expect(resumo.duracaoMediaMin).toBeNull();
  });
});
