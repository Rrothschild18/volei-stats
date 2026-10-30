import { defineFormat, TournamentFormat } from './tournament-format.model';

/**
 * Catálogo de formatos. Ver REGRAS.md §10.
 *
 * `status: 'available'` são os chaveamentos que o `TournamentService` já sabe
 * conduzir. `status: 'planned'` estão descritos para aparecer na escolha como
 * "ainda não disponível" — nunca como opção que trava o campeonato no meio.
 */
export const TOURNAMENT_FORMATS: readonly TournamentFormat[] = [
  // ---------------------------------------------------------------------------
  // Mata-mata simples (número par de jogadores)
  // ---------------------------------------------------------------------------
  defineFormat({
    id: 'knockout-2',
    name: 'Final direta',
    summary: 'Duas duplas, um jogo só: quem ganhar leva.',
    teamCount: 2,
    usesWaitingPlayer: false,
    recommendedCourts: 1,
    thirdPlace: 'never',
    thirdPlaceDefault: false,
    matchCount: 1,
    minGamesPerTeam: 1,
    status: 'available',
  }),
  defineFormat({
    id: 'knockout-3',
    name: 'Mata-mata com repescagem',
    summary:
      'Duas duplas abrem; quem perde pega a dupla que ficou de fora. ' +
      'O vencedor dessa repescagem vai à final.',
    teamCount: 3,
    usesWaitingPlayer: false,
    recommendedCourts: 1,
    thirdPlace: 'never',
    thirdPlaceDefault: false,
    matchCount: 3,
    minGamesPerTeam: 1,
    status: 'available',
  }),
  defineFormat({
    id: 'knockout-4',
    name: 'Semifinais',
    summary:
      'Duas semifinais, final e disputa de 3º lugar — ' +
      'com o 3º lugar ligado, todas as quatro duplas jogam duas vezes.',
    teamCount: 4,
    usesWaitingPlayer: false,
    recommendedCourts: 1,
    thirdPlace: 'optional',
    thirdPlaceDefault: true,
    matchCount: 4,
    minGamesPerTeam: 2,
    status: 'available',
  }),
  defineFormat({
    id: 'knockout-5',
    name: 'Mata-mata com bye',
    summary:
      'Quatro duplas abrem e uma espera. Quem perde por mais pontos está fora; ' +
      'quem vence por mais vai direto à final.',
    teamCount: 5,
    usesWaitingPlayer: false,
    recommendedCourts: 1,
    thirdPlace: 'optional',
    thirdPlaceDefault: false,
    matchCount: 4,
    minGamesPerTeam: 1,
    status: 'available',
  }),
  defineFormat({
    id: 'knockout-6',
    name: 'Mata-mata de seis',
    summary:
      'Três jogos de abertura. A dupla que vence por mais pontos vai direto à ' +
      'final; a que perde por mais está fora.',
    teamCount: 6,
    usesWaitingPlayer: false,
    recommendedCourts: 1,
    thirdPlace: 'optional',
    thirdPlaceDefault: true,
    matchCount: 6,
    minGamesPerTeam: 1,
    status: 'available',
  }),
  defineFormat({
    id: 'knockout-7',
    name: 'Mata-mata de sete',
    summary: 'Seis duplas abrem e uma espera, entrando direto na semifinal do bye.',
    teamCount: 7,
    usesWaitingPlayer: false,
    recommendedCourts: 1,
    thirdPlace: 'optional',
    thirdPlaceDefault: false,
    matchCount: 6,
    minGamesPerTeam: 1,
    status: 'available',
  }),

  // ---------------------------------------------------------------------------
  // Com encaixe do jogador avulso (número ímpar de jogadores)
  // ---------------------------------------------------------------------------
  defineFormat({
    id: 'encaixe-3',
    name: 'Três duplas + avulso',
    summary:
      'Depois do primeiro jogo, o avulso forma dupla com quem vencer o ' +
      'par-ou-ímpar da dupla que perdeu por menos.',
    teamCount: 3,
    usesWaitingPlayer: true,
    recommendedCourts: 1,
    thirdPlace: 'never',
    thirdPlaceDefault: false,
    matchCount: 3,
    minGamesPerTeam: 1,
    status: 'available',
  }),
  defineFormat({
    id: 'encaixe-4',
    name: 'Quatro duplas + avulso',
    summary:
      'A dupla do encaixe enfrenta quem venceu por menos pontos; ' +
      'quem venceu por mais espera na final.',
    teamCount: 4,
    usesWaitingPlayer: true,
    recommendedCourts: 1,
    thirdPlace: 'never',
    thirdPlaceDefault: false,
    matchCount: 4,
    minGamesPerTeam: 1,
    status: 'available',
  }),
  defineFormat({
    id: 'encaixe-5',
    name: 'Cinco duplas + avulso',
    summary: 'A dupla do encaixe entra contra a dupla que ficou de fora da abertura.',
    teamCount: 5,
    usesWaitingPlayer: true,
    recommendedCourts: 1,
    thirdPlace: 'optional',
    thirdPlaceDefault: false,
    matchCount: 5,
    minGamesPerTeam: 1,
    status: 'available',
  }),

  // ---------------------------------------------------------------------------
  // Fase de grupos — precisa de duas quadras para valer a pena
  // ---------------------------------------------------------------------------
  defineFormat({
    id: 'groups-2x3',
    name: 'Dois grupos de três',
    summary:
      'Dois grupos de três duplas jogando todos contra todos em quadras ' +
      'separadas. As duas melhores de cada grupo vão à semifinal. ' +
      'Toda dupla joga pelo menos duas vezes.',
    teamCount: 6,
    usesWaitingPlayer: false,
    recommendedCourts: 2,
    thirdPlace: 'optional',
    thirdPlaceDefault: true,
    matchCount: 10,
    minGamesPerTeam: 2,
    status: 'planned',
  }),
  defineFormat({
    id: 'knockout-8',
    name: 'Mata-mata de oito',
    summary: 'Quartas de final, semifinais e final — chave cheia, sem bye.',
    teamCount: 8,
    usesWaitingPlayer: false,
    recommendedCourts: 2,
    thirdPlace: 'optional',
    thirdPlaceDefault: true,
    matchCount: 8,
    minGamesPerTeam: 1,
    status: 'planned',
  }),
] as const;

/** Quantos jogadores no mínimo o catálogo consegue atender. */
export const MIN_SUPPORTED_PLAYERS = Math.min(...TOURNAMENT_FORMATS.map((f) => f.playerCount));

/** Quantos jogadores no máximo o catálogo consegue atender. */
export const MAX_SUPPORTED_PLAYERS = Math.max(...TOURNAMENT_FORMATS.map((f) => f.playerCount));

export function findFormat(id: string): TournamentFormat | undefined {
  return TOURNAMENT_FORMATS.find((format) => format.id === id);
}

/**
 * Ordena os formatos como devem aparecer na escolha: primeiro os jogáveis,
 * depois os que fazem todo mundo jogar mais vezes, depois os que pedem menos
 * quadra.
 */
function compareForDisplay(a: TournamentFormat, b: TournamentFormat): number {
  if (a.status !== b.status) {
    return a.status === 'available' ? -1 : 1;
  }
  if (a.minGamesPerTeam !== b.minGamesPerTeam) {
    return b.minGamesPerTeam - a.minGamesPerTeam;
  }
  if (a.recommendedCourts !== b.recommendedCourts) {
    return a.recommendedCourts - b.recommendedCourts;
  }
  return a.matchCount - b.matchCount;
}

/**
 * Todos os formatos que cabem exatamente nesse número de pessoas, jogáveis ou
 * não, já ordenados para exibição.
 */
export function formatsForPlayerCount(playerCount: number): TournamentFormat[] {
  return TOURNAMENT_FORMATS.filter((format) => format.playerCount === playerCount).sort(
    compareForDisplay,
  );
}

/** Só os formatos que dá para jogar hoje. */
export function availableFormatsForPlayerCount(playerCount: number): TournamentFormat[] {
  return formatsForPlayerCount(playerCount).filter((format) => format.status === 'available');
}

/** O formato sugerido por padrão, ou `undefined` se não houver nenhum jogável. */
export function defaultFormatForPlayerCount(playerCount: number): TournamentFormat | undefined {
  return availableFormatsForPlayerCount(playerCount)[0];
}

/**
 * Números de pessoas próximos que teriam algum formato jogável — para o app
 * poder dizer "com mais um jogador dá para montar X" em vez de só recusar.
 */
export function nearestPlayableCounts(playerCount: number, radius = 2): number[] {
  const counts = new Set<number>();
  for (let delta = 1; delta <= radius; delta++) {
    for (const candidate of [playerCount - delta, playerCount + delta]) {
      if (availableFormatsForPlayerCount(candidate).length > 0) {
        counts.add(candidate);
      }
    }
  }
  return [...counts].sort((a, b) => Math.abs(a - playerCount) - Math.abs(b - playerCount));
}
