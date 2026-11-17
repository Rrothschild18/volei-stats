import { describe, expect, it } from 'vitest';
import { quemAbreSacando } from './match-opening';

const DUPLA_A = 'team-a';
const DUPLA_B = 'team-b';

describe('quemAbreSacando', () => {
  it('quem ganhou o par-ou-ímpar e escolheu SAQUE abre sacando', () => {
    expect(
      quemAbreSacando({
        coinWinnerTeamId: DUPLA_A,
        coinChoice: 'saque',
        teamAId: DUPLA_A,
        teamBId: DUPLA_B,
      }),
    ).toBe(DUPLA_A);
  });

  it('quem escolheu LADO entrega o saque para a outra dupla', () => {
    expect(
      quemAbreSacando({
        coinWinnerTeamId: DUPLA_A,
        coinChoice: 'lado',
        teamAId: DUPLA_A,
        teamBId: DUPLA_B,
      }),
    ).toBe(DUPLA_B);
  });

  it('vale para qualquer um dos dois lados da partida', () => {
    expect(
      quemAbreSacando({
        coinWinnerTeamId: DUPLA_B,
        coinChoice: 'lado',
        teamAId: DUPLA_A,
        teamBId: DUPLA_B,
      }),
    ).toBe(DUPLA_A);
  });

  it('sem par-ou-ímpar registrado, ninguém abre sacando', () => {
    expect(
      quemAbreSacando({
        coinWinnerTeamId: null,
        coinChoice: 'saque',
        teamAId: DUPLA_A,
        teamBId: DUPLA_B,
      }),
    ).toBeNull();

    expect(
      quemAbreSacando({
        coinWinnerTeamId: DUPLA_A,
        coinChoice: null,
        teamAId: DUPLA_A,
        teamBId: DUPLA_B,
      }),
    ).toBeNull();
  });
});
