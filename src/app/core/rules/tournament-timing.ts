import { Match } from '../../shared/models';

/** Depois disto, um campeonato sem final não está rolando: ficou pelo caminho. */
const HORAS_ATE_DESISTIR = 12;

export interface TournamentTiming {
  /** Quando o campeonato nasceu: a proposta de sorteio escolhida. */
  readonly startedAt: string;
  /** Quando a final foi preenchida. Nulo enquanto ela não sai. */
  readonly endedAt: string | null;
  /** Minutos entre as duas pontas. Nulo quando não há o que contar. */
  readonly minutes: number | null;
  readonly finished: boolean;
  /** Começou, nunca teve final, e a noite já acabou faz tempo. */
  readonly abandoned: boolean;
}

/**
 * Quando o campeonato começou e quanto durou.
 *
 * O começo é a CRIAÇÃO, não a primeira partida: são minutos de diferença —
 * escolher o formato, caminhar até a quadra — e a criação é o único instante
 * que existe mesmo para um campeonato que ainda não teve jogo.
 *
 * O fim é o `playedAt` da final, e isso é estável de propósito: corrigir um
 * placar depois não mexe nele (o gatilho do banco só escreve `correctedAt`),
 * então a duração não muda retroativamente quando alguém conserta um número.
 *
 * Um campeonato que começou e nunca teve final não tem duração. Mostrar o tempo
 * decorrido nesse caso daria um número que cresce todo dia, para sempre.
 */
export function tournamentTiming(
  createdAt: string,
  matches: readonly Match[],
  agora: string,
): TournamentTiming {
  const final = matches.find((match) => match.phase === 'final' && match.winnerId !== null) ?? null;
  const endedAt = final?.playedAt ?? null;

  const minutosEntre = (de: string, ate: string) =>
    Math.max(0, Math.round((Date.parse(ate) - Date.parse(de)) / 60_000));

  if (endedAt) {
    return {
      startedAt: createdAt,
      endedAt,
      minutes: minutosEntre(createdAt, endedAt),
      finished: true,
      abandoned: false,
    };
  }

  const decorridos = minutosEntre(createdAt, agora);
  const abandoned = decorridos > HORAS_ATE_DESISTIR * 60;

  return {
    startedAt: createdAt,
    endedAt: null,
    minutes: abandoned ? null : decorridos,
    finished: false,
    abandoned,
  };
}

/** "48 min", "1h12". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const horas = Math.floor(minutes / 60);
  const resto = minutes % 60;
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, '0')}`;
}
