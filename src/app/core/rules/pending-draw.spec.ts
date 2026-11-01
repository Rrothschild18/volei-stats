import { describe, expect, it } from 'vitest';
import { drawPlayerIds, drawPresenceDiff, pendingDraw, presenceUnchanged } from './pending-draw';
import { DrawProposal, Tournament } from '../../shared/models';

function draw(id: string, createdAt: string, overrides: Partial<DrawProposal> = {}): DrawProposal {
  return {
    id,
    sessionId: 's1',
    teams: [
      { id: `${id}-a`, playerIds: ['rafa', 'bia'] },
      { id: `${id}-b`, playerIds: ['duda', 'leo'] },
    ],
    waitingPlayerId: null,
    score: 100,
    badges: [],
    selected: true,
    createdAt,
    ...overrides,
  };
}

function tournament(drawId: string): Tournament {
  return { id: `t-${drawId}`, drawId } as unknown as Tournament;
}

describe('pendingDraw', () => {
  it('é o sorteio escolhido que nenhum campeonato está usando', () => {
    const draws = [draw('d1', '2026-10-31T22:00:00.000Z'), draw('d2', '2026-10-31T23:00:00.000Z')];

    expect(pendingDraw(draws, [tournament('d1')])?.id).toBe('d2');
  });

  it('não existe quando um campeonato passa a usá-lo', () => {
    const draws = [draw('d1', '2026-10-31T22:00:00.000Z')];

    expect(pendingDraw(draws, [tournament('d1')])).toBeNull();
  });

  it('ignora as propostas que não foram escolhidas', () => {
    const draws = [draw('d1', '2026-10-31T22:00:00.000Z', { selected: false })];

    expect(pendingDraw(draws, [])).toBeNull();
  });

  it('com dois órfãos, vale o mais recente — o anterior não acumula', () => {
    const draws = [draw('d2', '2026-10-31T23:30:00.000Z'), draw('d1', '2026-10-31T22:00:00.000Z')];

    expect(pendingDraw(draws, [])?.id).toBe('d2');
  });
});

describe('drawPresenceDiff', () => {
  it('conta o avulso como gente do sorteio', () => {
    const entry = draw('d1', '2026-10-31T22:00:00.000Z', { waitingPlayerId: 'malu' });

    expect(drawPlayerIds(entry)).toContain('malu');
  });

  it('não aponta nada quando a presença é a mesma', () => {
    const entry = draw('d1', '2026-10-31T22:00:00.000Z');
    const diff = drawPresenceDiff(entry, ['rafa', 'bia', 'duda', 'leo']);

    expect(presenceUnchanged(diff)).toBe(true);
  });

  it('aponta quem foi embora e quem chegou depois', () => {
    const entry = draw('d1', '2026-10-31T22:00:00.000Z');
    const diff = drawPresenceDiff(entry, ['rafa', 'bia', 'duda', 'nina']);

    expect(diff.gone).toEqual(['leo']);
    expect(diff.arrived).toEqual(['nina']);
    expect(presenceUnchanged(diff)).toBe(false);
  });
});
