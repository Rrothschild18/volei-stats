import { describe, expect, it } from 'vitest';
import { countWaitsInSession, waitingCandidates } from './waiting-rotation';
import { DrawProposal, Tournament } from '../../shared/models';

function draw(overrides: Partial<DrawProposal> & Pick<DrawProposal, 'id'>): DrawProposal {
  return {
    sessionId: 's1',
    teams: [],
    waitingPlayerId: null,
    score: 100,
    badges: [],
    selected: false,
    createdAt: '2026-10-26T22:00:00.000Z',
    ...overrides,
  };
}

function tournament(
  overrides: Partial<Tournament> & Pick<Tournament, 'id' | 'drawId'>,
): Tournament {
  return {
    name: 'Campeonato',
    sessionId: 's1',
    formatId: 'encaixe-5',
    teams: [],
    waitingPlayerId: null,
    oddPlayerPlacementEnabled: true,
    oddPlayerLoserPriorityEnabled: true,
    oddPlayerPlacement: null,
    priorityEntries: [],
    pointLimit: 12,
    thirdPlaceEnabled: false,
    matches: [],
    status: 'completed',
    finalStandings: [],
    tiebreakDecisions: [],
    createdAt: '2026-10-26T22:00:00.000Z',
    updatedAt: '2026-10-26T22:00:00.000Z',
    ...overrides,
  };
}

describe('countWaitsInSession', () => {
  it('conta só os sorteios escolhidos', () => {
    const counts = countWaitsInSession(
      [
        draw({ id: 'a', selected: true, waitingPlayerId: 'caio' }),
        draw({ id: 'b', selected: false, waitingPlayerId: 'malu' }),
        draw({ id: 'c', selected: false, waitingPlayerId: 'gui' }),
      ],
      [],
    );

    expect(counts.get('caio')).toBe(1);
    expect(counts.has('malu')).toBe(false);
    expect(counts.has('gui')).toBe(false);
  });

  it('não conta duas vezes o avulso do sorteio e do campeonato que nasceu dele', () => {
    const counts = countWaitsInSession(
      [draw({ id: 'a', selected: true, waitingPlayerId: 'caio' })],
      [tournament({ id: 't1', drawId: 'a', waitingPlayerId: 'caio' })],
    );

    expect(counts.get('caio')).toBe(1);
  });

  it('conta o campeonato sem sorteio correspondente', () => {
    const counts = countWaitsInSession(
      [],
      [tournament({ id: 't1', drawId: 'perdido', waitingPlayerId: 'malu' })],
    );

    expect(counts.get('malu')).toBe(1);
  });

  it('soma as esperas de sessões com mais de um sorteio', () => {
    const counts = countWaitsInSession(
      [
        draw({ id: 'a', selected: true, waitingPlayerId: 'caio' }),
        draw({ id: 'b', selected: true, waitingPlayerId: 'malu' }),
        draw({ id: 'c', selected: true, waitingPlayerId: 'caio' }),
      ],
      [],
    );

    expect(counts.get('caio')).toBe(2);
    expect(counts.get('malu')).toBe(1);
  });
});

describe('waitingCandidates', () => {
  const present = [
    'rafa',
    'bia',
    'duda',
    'leo',
    'carol',
    'thiago',
    'nina',
    'gui',
    'paty',
    'caio',
    'malu',
  ];

  it('tira os prioritários do sorteio da espera', () => {
    const candidates = waitingCandidates(present, ['thiago', 'nina', 'carol'], new Map());

    expect(candidates).not.toContain('thiago');
    expect(candidates).not.toContain('nina');
    expect(candidates).not.toContain('carol');
    expect(candidates).toHaveLength(8);
  });

  it('só sorteia entre quem ainda não esperou hoje', () => {
    const counts = new Map([
      ['caio', 1],
      ['malu', 1],
    ]);

    const candidates = waitingCandidates(present, ['thiago', 'nina', 'carol'], counts);

    expect(candidates).not.toContain('caio');
    expect(candidates).not.toContain('malu');
    // Sobram os 6 que não esperaram e não são prioritários.
    expect(candidates).toEqual(['rafa', 'bia', 'duda', 'leo', 'gui', 'paty']);
  });

  it('reabre a roda quando todo mundo já esperou uma vez', () => {
    const counts = new Map(present.map((playerId) => [playerId, 1]));
    counts.set('caio', 2);

    const candidates = waitingCandidates(present, [], counts);

    expect(candidates).not.toContain('caio');
    expect(candidates).toHaveLength(10);
  });

  it('cede a prioridade quando todos os presentes são prioritários', () => {
    const candidates = waitingCandidates(
      ['rafa', 'bia', 'duda'],
      ['rafa', 'bia', 'duda'],
      new Map(),
    );

    expect(candidates).toEqual(['rafa', 'bia', 'duda']);
  });
});
