import { describe, expect, it } from 'vitest';
import { tournamentTiming } from './tournament-timing';
import { Match, MatchPhase } from '../../shared/models';

function match(phase: MatchPhase, playedAt: string): Match {
  return {
    id: phase,
    tournamentId: 't',
    sessionId: 's',
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

const COMECO = '2026-10-31T22:00:00.000Z';

describe('tournamentTiming', () => {
  it('sem final, o campeonato ainda está rolando', () => {
    const t = tournamentTiming(COMECO, [match('round-1', '2026-10-31T22:10:00.000Z')], COMECO);

    expect(t.startedAt).toBe(COMECO);
    expect(t.endedAt).toBeNull();
    expect(t.finished).toBe(false);
  });

  it('a final fecha a conta', () => {
    const t = tournamentTiming(
      COMECO,
      [match('round-1', '2026-10-31T22:10:00.000Z'), match('final', '2026-10-31T22:48:00.000Z')],
      COMECO,
    );

    expect(t.endedAt).toBe('2026-10-31T22:48:00.000Z');
    expect(t.minutes).toBe(48);
    expect(t.finished).toBe(true);
  });

  it('em andamento, a duração é o tempo decorrido até agora', () => {
    const t = tournamentTiming(COMECO, [], '2026-10-31T22:25:00.000Z');

    expect(t.minutes).toBe(25);
    expect(t.finished).toBe(false);
  });

  it('corrigir um placar não mexe na duração', () => {
    const final = match('final', '2026-10-31T22:48:00.000Z');
    const corrigida: Match = {
      ...final,
      scoreB: 9,
      correctedBy: 'p1',
      correctedAt: '2026-11-01T09:00:00.000Z',
    };

    expect(tournamentTiming(COMECO, [corrigida], COMECO).minutes).toBe(48);
  });

  it('o relógio de um campeonato abandonado não cresce para sempre', () => {
    // A noite acabou sem final. Em vez de um número que aumenta todo dia, a
    // tela precisa saber que não há duração.
    const t = tournamentTiming(
      COMECO,
      [match('round-1', '2026-10-31T22:10:00.000Z')],
      '2026-11-03T20:00:00.000Z',
    );

    expect(t.abandoned).toBe(true);
    expect(t.minutes).toBeNull();
  });
});
