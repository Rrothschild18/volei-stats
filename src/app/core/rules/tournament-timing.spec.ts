import { describe, expect, it } from 'vitest';
import { TournamentTiming, correctionWindowOpen, tournamentTiming } from './tournament-timing';
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

describe('correctionWindowOpen', () => {
  const FINAL = '2026-10-26T23:40:00.000Z';

  function comFinal(playedAt: string): TournamentTiming {
    return tournamentTiming('2026-10-26T22:00:00.000Z', [match('final', playedAt)], playedAt);
  }

  it('campeonato rolando: corrigir vale sem prazo', () => {
    const timing = tournamentTiming('2026-10-26T22:00:00.000Z', [], '2026-10-26T23:00:00.000Z');

    expect(timing.endedAt).toBeNull();
    expect(correctionWindowOpen(timing, '2026-11-20T10:00:00.000Z')).toBe(true);
  });

  it('dentro dos 30 min depois da final, corrigir vale', () => {
    expect(correctionWindowOpen(comFinal(FINAL), '2026-10-27T00:09:00.000Z')).toBe(true);
  });

  it('nos 30 min exatos ainda vale', () => {
    expect(correctionWindowOpen(comFinal(FINAL), '2026-10-27T00:10:00.000Z')).toBe(true);
  });

  it('31 min depois da final, não vale mais', () => {
    expect(correctionWindowOpen(comFinal(FINAL), '2026-10-27T00:11:00.000Z')).toBe(false);
  });

  it('o prazo conta do fim do campeonato, não de quando a tela abriu', () => {
    // Duas semanas depois: o campeonato já virou ranking de todo mundo.
    expect(correctionWindowOpen(comFinal(FINAL), '2026-11-09T20:00:00.000Z')).toBe(false);
  });
});
