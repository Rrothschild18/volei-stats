/**
 * Catálogo de formatos de campeonato.
 *
 * O chaveamento deixou de ser um `switch` escondido por número de duplas: cada
 * formato é uma entrada de dados, para que o app possa **mostrar ao organizador
 * quais campeonatos dá para montar com as pessoas que apareceram** e ele
 * escolher — levando em conta quadras disponíveis e quantas vezes cada dupla
 * joga.
 *
 * Ver REGRAS.md §10.
 */

/** Disponibilidade da disputa de 3º/4º lugar dentro de um formato. */
export type ThirdPlaceSupport =
  /** O organizador decide; `thirdPlaceDefault` diz como vem marcado. */
  | 'optional'
  /** O formato não comporta — a opção nem aparece. */
  | 'never';

export type FormatStatus =
  /** Chaveamento implementado: dá para jogar hoje. */
  | 'available'
  /** Catalogado e descrito, mas o chaveamento ainda não existe. */
  | 'planned';

export interface TournamentFormat {
  readonly id: string;
  /** Nome curto, como o organizador chamaria na quadra. */
  readonly name: string;
  readonly summary: string;
  /** Duplas que entram no sorteio (não conta a dupla do encaixe). */
  readonly teamCount: number;
  /** Se o formato usa o jogador avulso via encaixe. */
  readonly usesWaitingPlayer: boolean;
  /** Pessoas necessárias: `teamCount * 2` (+1 se houver avulso). */
  readonly playerCount: number;
  /**
   * Quadras para jogar no ritmo previsto. Dá para rodar com menos, jogando em
   * sequência — formatos de grupos só fazem sentido com jogos em paralelo.
   */
  readonly recommendedCourts: number;
  readonly thirdPlace: ThirdPlaceSupport;
  /** Como a opção de 3º lugar vem marcada por padrão (REGRAS.md §9.6). */
  readonly thirdPlaceDefault: boolean;
  /** Total de partidas, já considerando `thirdPlaceDefault`. */
  readonly matchCount: number;
  /**
   * Quantas partidas a dupla **menos** sortuda joga, considerando
   * `thirdPlaceDefault`. É o número que responde "todo mundo joga 2 vezes?".
   */
  readonly minGamesPerTeam: number;
  readonly status: FormatStatus;
}

export type TournamentFormatSpec = Omit<TournamentFormat, 'playerCount'>;

/** Completa a entrada do catálogo com o total de pessoas. */
export function defineFormat(spec: TournamentFormatSpec): TournamentFormat {
  return {
    ...spec,
    playerCount: spec.teamCount * 2 + (spec.usesWaitingPlayer ? 1 : 0),
  };
}
