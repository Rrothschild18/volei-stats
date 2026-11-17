import { describe, expect, it } from 'vitest';
import { byPlayerWins, byTeamWins } from './stats-order';
import { PlayerStats, TeamStats } from '../../shared/models';

function stats(playerId: string, wins: number, gamesPlayed: number): PlayerStats {
  return {
    playerId,
    gamesPlayed,
    wins,
    losses: gamesPlayed - wins,
    timesWaited: 0,
    winPercentage: gamesPlayed > 0 ? Math.round((100 * wins) / gamesPlayed) : 0,
  };
}

const nomes = new Map([
  ['douglas', 'Douglas'],
  ['mateus', 'Mateus napa'],
  ['wily', 'Wily'],
  ['be', 'Be'],
]);
const nomeDe = (playerId: string) => nomes.get(playerId) ?? '?';

describe('byPlayerWins', () => {
  it('põe quem tem mais vitórias na frente, mesmo com aproveitamento pior', () => {
    // Números reais do Vôlei Unaerp: Douglas 71% em 17 jogos, Mateus 86% em 7.
    const douglas = stats('douglas', 12, 17);
    const mateus = stats('mateus', 6, 7);

    expect([mateus, douglas].sort(byPlayerWins(nomeDe))).toEqual([douglas, mateus]);
  });

  it('empate em vitórias vai para quem jogou mais', () => {
    const wily = stats('wily', 8, 14);
    const be = stats('be', 8, 12);

    expect([be, wily].sort(byPlayerWins(nomeDe))).toEqual([wily, be]);
  });

  it('empate total é desfeito pelo nome, para a ordem não dançar entre cargas', () => {
    const be = stats('be', 5, 10);
    const wily = stats('wily', 5, 10);

    expect([wily, be].sort(byPlayerWins(nomeDe))).toEqual([be, wily]);
  });
});

function dupla(names: [string, string], wins: number, gamesPlayed: number): TeamStats {
  return {
    playerIds: [names[0].toLowerCase(), names[1].toLowerCase()],
    playerNames: names,
    gamesPlayed,
    wins,
    losses: gamesPlayed - wins,
    winPercentage: Math.round((100 * wins) / gamesPlayed),
  };
}

describe('byTeamWins', () => {
  it('ordena duplas por vitórias, não por aproveitamento', () => {
    // Douglas + Wily: 5 jogos juntos no Vôlei Unaerp. A dupla de uma partida só
    // com 100% não lidera nada.
    const douglasWily = dupla(['Douglas', 'Wily'], 4, 5);
    const sorteDeUmJogo = dupla(['Be', 'Pati'], 1, 1);

    expect([sorteDeUmJogo, douglasWily].sort(byTeamWins())).toEqual([douglasWily, sorteDeUmJogo]);
  });

  it('empate em vitórias e jogos é desfeito pelo nome da dupla', () => {
    const a = dupla(['Binho', 'Pedrin'], 2, 3);
    const b = dupla(['Be', 'Douglas'], 2, 3);

    expect([a, b].sort(byTeamWins())).toEqual([b, a]);
  });
});
