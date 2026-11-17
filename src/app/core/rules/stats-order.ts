import { PlayerStats, TeamStats } from '../../shared/models';

/**
 * A régua das estatísticas: **vitórias**, não aproveitamento.
 *
 * Aproveitamento punia quem joga muito e premiava quem apareceu numa noite boa
 * — nos dados reais, 86% em 7 jogos de uma noite passava na frente de 71% em 17
 * jogos de duas. Vitória é um contador que só sobe: quem vem sempre sobe, e
 * ninguém perde posição por ter jogado numa noite ruim.
 *
 * O empate vai para quem **jogou mais**, que é presença e não habilidade, e o
 * nome fecha a ordem — sem ele, duas pessoas idênticas trocam de lugar a cada
 * carga, porque `Array#sort` não garante ordem entre iguais em toda plataforma.
 */
export function byPlayerWins(
  nameOf: (playerId: string) => string,
): (a: PlayerStats, b: PlayerStats) => number {
  return (a, b) =>
    b.wins - a.wins ||
    b.gamesPlayed - a.gamesPlayed ||
    nameOf(a.playerId).localeCompare(nameOf(b.playerId));
}

/** A mesma régua para duplas; o nome da dupla já vem no registro. */
export function byTeamWins(): (a: TeamStats, b: TeamStats) => number {
  return (a, b) =>
    b.wins - a.wins ||
    b.gamesPlayed - a.gamesPlayed ||
    a.playerNames.join(' + ').localeCompare(b.playerNames.join(' + '));
}
