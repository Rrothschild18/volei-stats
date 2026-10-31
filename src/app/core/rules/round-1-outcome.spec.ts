import { describe, expect, it } from 'vitest';
import { readRound1 } from './round-1-outcome';
import { Match, TiebreakDecision } from '../../shared/models';

function round1Match(teamAId: string, teamBId: string, scoreA: number, scoreB: number): Match {
  return {
    id: `${teamAId}-${teamBId}`,
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
    playedAt: '2026-10-26T22:12:00.000Z',
    reportedBy: null,
    correctedBy: null,
    correctedAt: null,
    createdAt: '2026-10-26T22:12:00.000Z',
  };
}

describe('readRound1', () => {
  it('ordena vencedores e perdedores pela diferença', () => {
    const outcome = readRound1(
      [round1Match('thiago-nina', 'carol-gui', 12, 7), round1Match('leo-bia', 'rafa-paty', 12, 10)],
      { expectedMatches: 2 },
    );

    expect(outcome.winners.map((entry) => entry.id)).toEqual(['thiago-nina', 'leo-bia']);
    expect(outcome.losers.map((entry) => entry.id)).toEqual(['carol-gui', 'rafa-paty']);
    expect(outcome.needsTiebreak).toBeNull();
  });

  it('pausa a chave quando os perdedores empatam na diferença', () => {
    const outcome = readRound1(
      [round1Match('rafa-bia', 'carol-gui', 12, 9), round1Match('leo-duda', 'rafa-paty', 12, 9)],
      { expectedMatches: 2 },
    );

    expect(outcome.needsTiebreak).toEqual({
      kind: 'losers',
      teamIds: ['carol-gui', 'rafa-paty'],
    });
  });

  it('pede uma decisão por vez: a diferença de uma partida vale para os dois lados', () => {
    // 12×9 e 11×8 são a mesma diferença, então empatam tanto a fronteira dos
    // perdedores (quem está fora) quanto a dos vencedores (quem vai à final).
    // A dos perdedores vem primeiro, porque é ela que elimina alguém.
    const outcome = readRound1(
      [round1Match('rafa-bia', 'carol-gui', 12, 9), round1Match('leo-duda', 'rafa-paty', 11, 8)],
      { expectedMatches: 2 },
    );

    expect(outcome.needsTiebreak).toEqual({
      kind: 'losers',
      teamIds: ['carol-gui', 'rafa-paty'],
    });

    const afterLosers = readRound1(
      [round1Match('rafa-bia', 'carol-gui', 12, 9), round1Match('leo-duda', 'rafa-paty', 11, 8)],
      {
        expectedMatches: 2,
        decisions: [
          {
            kind: 'losers',
            teamIds: ['carol-gui', 'rafa-paty'],
            winnerTeamId: 'rafa-paty',
            decidedBy: 'p-duda',
            decidedAt: '2026-10-26T23:28:00.000Z',
          },
        ],
      },
    );

    expect(afterLosers.needsTiebreak).toEqual({
      kind: 'winners',
      teamIds: ['rafa-bia', 'leo-duda'],
    });
  });

  it('usa o vencedor do par-ou-ímpar como critério, e não repete a mesma decisão', () => {
    const decisions: TiebreakDecision[] = [
      {
        kind: 'losers',
        teamIds: ['carol-gui', 'rafa-paty'],
        winnerTeamId: 'rafa-paty',
        decidedBy: 'p-duda',
        decidedAt: '2026-10-26T23:28:00.000Z',
      },
      {
        kind: 'winners',
        teamIds: ['rafa-bia', 'leo-duda'],
        winnerTeamId: 'leo-duda',
        decidedBy: 'p-duda',
        decidedAt: '2026-10-26T23:30:00.000Z',
      },
    ];

    const outcome = readRound1(
      [round1Match('rafa-bia', 'carol-gui', 12, 9), round1Match('leo-duda', 'rafa-paty', 12, 9)],
      { expectedMatches: 2, decisions },
    );

    expect(outcome.needsTiebreak).toBeNull();
    // Rafa + Paty venceu o par-ou-ímpar dos perdedores, então disputa o encaixe
    // (último da lista) e Carol + Gui é a eliminada direta (primeiro).
    expect(outcome.losers.map((entry) => entry.id)).toEqual(['carol-gui', 'rafa-paty']);
    // Léo + Duda venceu o dos vencedores, então vai direto à final.
    expect(outcome.winners.map((entry) => entry.id)).toEqual(['leo-duda', 'rafa-bia']);
  });

  it('não procura fronteira com uma partida só na rodada 1', () => {
    const outcome = readRound1([round1Match('rafa-bia', 'carol-gui', 12, 9)], {
      expectedMatches: 1,
    });

    expect(outcome.needsTiebreak).toBeNull();
    expect(outcome.winners).toHaveLength(1);
  });
});

describe('readRound1 com a rodada 1 pela metade', () => {
  it('não pausa a chave por um empate entre duas de três partidas', () => {
    // knockout-6: a terceira partida ainda pode desfazer o empate.
    const outcome = readRound1([round1Match('a1', 'a2', 12, 9), round1Match('b1', 'b2', 11, 8)], {
      expectedMatches: 3,
    });

    expect(outcome.needsTiebreak).toBeNull();
  });

  it('pausa quando a terceira partida entra e o empate continua na fronteira', () => {
    const outcome = readRound1(
      [
        round1Match('a1', 'a2', 12, 9),
        round1Match('b1', 'b2', 11, 8),
        round1Match('c1', 'c2', 12, 5),
      ],
      { expectedMatches: 3 },
    );

    // c2 perdeu por 7 e está fora; a1 e b1 empatam na frente dos vencedores.
    expect(outcome.needsTiebreak).toEqual({ kind: 'winners', teamIds: ['a1', 'b1'] });
  });

  it('só olha a segunda posição dos perdedores quando há disputa de 3º lugar', () => {
    const matches = [
      round1Match('a1', 'a2', 12, 2),
      round1Match('b1', 'b2', 12, 9),
      round1Match('c1', 'c2', 11, 8),
    ];

    // Sem 3º lugar, o empate de a2/b2 em -3 não decide nada.
    expect(readRound1(matches, { expectedMatches: 3 }).needsTiebreak).toEqual({
      kind: 'winners',
      teamIds: ['b1', 'c1'],
    });

    expect(
      readRound1(matches, { expectedMatches: 3, thirdPlaceEnabled: true }).needsTiebreak,
    ).toEqual({ kind: 'losers', teamIds: ['b2', 'c2'] });
  });
});
