import { describe, expect, it } from 'vitest';
import { PriorityFreeze, priorityFrozen } from './priority-freeze';

function freeze(overrides: Partial<PriorityFreeze> = {}): PriorityFreeze {
  return {
    status: 'in-progress',
    expectedRound1Matches: 2,
    playedRound1Matches: 2,
    pendingTiebreak: false,
    usesOddPlayerPlacement: false,
    oddPlayerPlacementDecided: false,
    ...overrides,
  };
}

describe('priorityFrozen', () => {
  it('congela com a rodada 1 fechada, sem desempate e sem encaixe', () => {
    expect(priorityFrozen(freeze())).toBe(true);
  });

  it('não congela enquanto falta partida na rodada 1', () => {
    expect(priorityFrozen(freeze({ playedRound1Matches: 1 }))).toBe(false);
  });

  it('num formato de três partidas na rodada 1, a condição cai mais tarde', () => {
    const tresPartidas = { expectedRound1Matches: 3 };
    expect(priorityFrozen(freeze({ ...tresPartidas, playedRound1Matches: 2 }))).toBe(false);
    expect(priorityFrozen(freeze({ ...tresPartidas, playedRound1Matches: 3 }))).toBe(true);
  });

  it('não congela com desempate pendente: a chave está pausada', () => {
    expect(priorityFrozen(freeze({ pendingTiebreak: true }))).toBe(false);
  });

  it('com encaixe, espera o par-ou-ímpar ser aplicado', () => {
    expect(priorityFrozen(freeze({ usesOddPlayerPlacement: true }))).toBe(false);
    expect(
      priorityFrozen(freeze({ usesOddPlayerPlacement: true, oddPlayerPlacementDecided: true })),
    ).toBe(true);
  });

  it('nos formatos que abrem em semifinal ou final, já está decidido', () => {
    expect(priorityFrozen(freeze({ expectedRound1Matches: 0, playedRound1Matches: 0 }))).toBe(true);
  });

  it('campeonato encerrado dispensa a conta', () => {
    expect(priorityFrozen(freeze({ status: 'completed', playedRound1Matches: 0 }))).toBe(true);
  });
});
