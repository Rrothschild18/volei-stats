import { describe, expect, it } from 'vitest';
import { plannedPhases } from './bracket-phases';
import { TOURNAMENT_FORMATS } from './tournament-formats';

describe('plannedPhases', () => {
  const implemented = TOURNAMENT_FORMATS.filter((format) => format.status === 'available');

  it.each(implemented.map((format) => [format.id, format] as const))(
    'o caminho de %s tem o total de partidas do catálogo',
    (_id, format) => {
      expect(plannedPhases(format)).toHaveLength(format.matchCount);
    },
  );

  it('coloca a disputa de 3º lugar antes da final', () => {
    const knockout4 = TOURNAMENT_FORMATS.find((format) => format.id === 'knockout-4')!;

    expect(plannedPhases(knockout4)).toEqual(['semifinal', 'semifinal', 'third-place', 'final']);
  });

  it('descreve o encaixe de cinco duplas como na quadra', () => {
    const encaixe5 = TOURNAMENT_FORMATS.find((format) => format.id === 'encaixe-5')!;

    expect(plannedPhases(encaixe5)).toEqual([
      'round-1',
      'round-1',
      'semifinal-bye',
      'semifinal',
      'final',
    ]);
  });
});
