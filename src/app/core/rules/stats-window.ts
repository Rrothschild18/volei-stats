import {
  PlayerSessionStats,
  PlayerStats,
  Session,
  TeamSessionStats,
  TeamStats,
} from '../../shared/models';

/**
 * A janela das estatísticas: as últimas noites, não o histórico inteiro.
 *
 * Quatro sessões é o padrão porque é o que dá amostra sem virar arquivo: no
 * vôlei real são ~4 campeonatos por noite, então quatro noites são ~64
 * partidas e 25 a 30 jogos por pessoa. Uma noite sozinha são 4 a 10 jogos —
 * pouco demais para o mural dizer alguma coisa.
 *
 * A janela é **deslizante**, não cíclica: quem jogou muito bem numa noite
 * mantém os números melhores até aquela noite sair pela quarta posição.
 *
 * São EVENTOS e não semanas de propósito. "Últimas 4 semanas" vira duas noites
 * quando chove ou cai feriado, e a qualidade do mural despencaria sozinha, sem
 * ninguém ter feito nada.
 */
export const JANELA_PADRAO = 4;

/**
 * As noites que podem entrar na janela: as que tiveram campeonato.
 *
 * Uma sessão nasce quando alguém marca presença, antes de qualquer jogo. Sem
 * este corte, a noite de hoje ocupa uma vaga da janela no minuto em que a
 * presença é salva, e o mural passa a somar três noites de jogo enquanto a
 * tela promete quatro.
 */
export function noitesComCampeonato(sessions: readonly Session[]): Session[] {
  return sessions.filter((session) => session.tournamentIds.length > 0);
}

/** As `quantas` sessões mais recentes do vôlei, pela data. */
export function lastSessionIds(
  sessions: readonly Session[],
  quantas = JANELA_PADRAO,
): ReadonlySet<string> {
  return new Set(
    [...sessions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, quantas)
      .map((session) => session.id),
  );
}

/**
 * Soma as noites da janela num total por jogador.
 *
 * `sessionIds` nulo é o histórico inteiro — é o que o botão "desde sempre"
 * manda. O aproveitamento é recalculado do total somado, nunca somado das
 * noites: média de porcentagens não é porcentagem da soma.
 */
export function sumPlayerStats(
  rows: readonly PlayerSessionStats[],
  sessionIds: ReadonlySet<string> | null,
): PlayerStats[] {
  const total = new Map<string, PlayerStats>();

  for (const row of rows) {
    if (sessionIds && !sessionIds.has(row.sessionId)) {
      continue;
    }

    const entry = total.get(row.playerId) ?? {
      playerId: row.playerId,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      timesWaited: 0,
      winPercentage: 0,
    };

    total.set(row.playerId, {
      ...entry,
      gamesPlayed: entry.gamesPlayed + row.gamesPlayed,
      wins: entry.wins + row.wins,
      losses: entry.losses + row.losses,
      timesWaited: entry.timesWaited + row.timesWaited,
    });
  }

  return [...total.values()].map((entry) => ({
    ...entry,
    winPercentage: entry.gamesPlayed > 0 ? Math.round((100 * entry.wins) / entry.gamesPlayed) : 0,
  }));
}

/**
 * O mesmo para duplas. A dupla é o PAR de jogadores, não o id da dupla: a
 * mesma dupla sorteada em dias diferentes é a mesma dupla, e é por isso que a
 * chave aqui é o par ordenado.
 */
export function sumTeamStats(
  rows: readonly TeamSessionStats[],
  sessionIds: ReadonlySet<string> | null,
  nameOf: (playerId: string) => string,
): TeamStats[] {
  const total = new Map<string, { playerIds: [string, string]; wins: number; losses: number }>();

  for (const row of rows) {
    if (sessionIds && !sessionIds.has(row.sessionId)) {
      continue;
    }

    const playerIds = [...row.playerIds].sort() as [string, string];
    const key = playerIds.join('|');
    const entry = total.get(key) ?? { playerIds, wins: 0, losses: 0 };

    total.set(key, {
      playerIds,
      wins: entry.wins + row.wins,
      losses: entry.losses + row.losses,
    });
  }

  return [...total.values()].map((entry) => {
    const gamesPlayed = entry.wins + entry.losses;
    return {
      playerIds: entry.playerIds,
      playerNames: [nameOf(entry.playerIds[0]), nameOf(entry.playerIds[1])] as [string, string],
      gamesPlayed,
      wins: entry.wins,
      losses: entry.losses,
      winPercentage: gamesPlayed > 0 ? Math.round((100 * entry.wins) / gamesPlayed) : 0,
    };
  });
}
