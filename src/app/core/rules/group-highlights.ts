import { Match, Tournament } from '../../shared/models';
import { DestaqueDeJogadores, PartidaDestaque } from './session-summary';

/**
 * O mural da home (ticket 06): o que o vôlei tem a comemorar.
 *
 * Três recortes, e cada destaque diz o seu:
 *   - **janela** (as últimas noites): mais vitórias, mais pontos, mais títulos;
 *   - **agora**: a sequência viva, que só vale para quem jogou na última noite;
 *   - **desde sempre**: dupla do coração, o clássico e os recordes.
 *
 * Nenhum `%` aqui. Aproveitamento é ranking disfarçado, e o mural é para
 * parabenizar — por isso também não há "pior" nada.
 */
export interface ParDeJogadores {
  readonly playerIds: readonly [string, string];
  readonly jogos: number;
}

export interface DestaquesDoGrupo {
  readonly maisVitorias: DestaqueDeJogadores | null;
  readonly maisPontos: DestaqueDeJogadores | null;
  readonly maisTitulos: DestaqueDeJogadores | null;
  /** Vitórias seguidas AGORA. Some para quem não veio na última noite. */
  readonly emSequencia: DestaqueDeJogadores | null;
  /** Os dois que mais jogaram juntos, desde sempre. */
  readonly duplaDoCoracao: ParDeJogadores | null;
  /** Os dois que mais se enfrentaram, desde sempre. */
  readonly classico: ParDeJogadores | null;
  readonly recordeDeSequencia: DestaqueDeJogadores | null;
  readonly maisElastico: PartidaDestaque | null;
  /** O jogo com mais pontos somados: o que foi mais longe no "vai a dois". */
  readonly maisDisputado: PartidaDestaque | null;
}

function lideres(contagem: ReadonlyMap<string, number>, minimo = 1): DestaqueDeJogadores | null {
  let valor = 0;
  for (const quanto of contagem.values()) {
    valor = Math.max(valor, quanto);
  }
  if (valor < minimo) {
    return null;
  }
  return {
    playerIds: [...contagem.entries()]
      .filter(([, quanto]) => quanto === valor)
      .map(([playerId]) => playerId)
      .sort(),
    valor,
  };
}

function parMaisFrequente(
  contagem: ReadonlyMap<string, number>,
  minimo: number,
): ParDeJogadores | null {
  const [chave, jogos] =
    [...contagem.entries()].sort(([a, x], [b, y]) => y - x || a.localeCompare(b))[0] ?? [];
  if (!chave || !jogos || jogos < minimo) {
    return null;
  }
  const [a, b] = chave.split('|');
  return { playerIds: [a, b], jogos };
}

export function destaquesDoGrupo(entrada: {
  matches: readonly Match[];
  tournaments: readonly Tournament[];
  /** As noites da janela; nulo = desde sempre. */
  janela: ReadonlySet<string> | null;
}): DestaquesDoGrupo {
  const { tournaments, janela } = entrada;

  const duplas = new Map<string, readonly string[]>();
  for (const tournament of tournaments) {
    for (const team of tournament.teams) {
      duplas.set(team.id, team.playerIds);
    }
  }

  const jogos = entrada.matches
    .filter((match) => !!match.winnerId)
    .sort((a, b) => a.playedAt.localeCompare(b.playedAt));

  const naJanela = (sessionId: string) => !janela || janela.has(sessionId);

  const vitorias = new Map<string, number>();
  const pontos = new Map<string, number>();
  const sequencia = new Map<string, number>();
  const recorde = new Map<string, number>();
  const juntos = new Map<string, number>();
  const opostos = new Map<string, number>();

  const chave = (a: string, b: string) => [a, b].sort().join('|');
  const soma = (mapa: Map<string, number>, id: string, quanto = 1) =>
    mapa.set(id, (mapa.get(id) ?? 0) + quanto);

  for (const match of jogos) {
    const lados = [
      {
        jogadores: duplas.get(match.teamAId) ?? [],
        pontos: match.scoreA,
        venceu: match.winnerId === match.teamAId,
      },
      {
        jogadores: duplas.get(match.teamBId) ?? [],
        pontos: match.scoreB,
        venceu: match.winnerId === match.teamBId,
      },
    ];

    for (const lado of lados) {
      for (const playerId of lado.jogadores) {
        if (naJanela(match.sessionId)) {
          soma(pontos, playerId, lado.pontos);
          if (lado.venceu) {
            soma(vitorias, playerId);
          }
        }

        // A sequência atravessa noites: ela é do jogador, não da janela.
        const seguidas = lado.venceu ? (sequencia.get(playerId) ?? 0) + 1 : 0;
        sequencia.set(playerId, seguidas);
        recorde.set(playerId, Math.max(recorde.get(playerId) ?? 0, seguidas));
      }

      if (lado.jogadores.length === 2) {
        soma(juntos, chave(lado.jogadores[0], lado.jogadores[1]));
      }
    }

    for (const a of lados[0].jogadores) {
      for (const b of lados[1].jogadores) {
        soma(opostos, chave(a, b));
      }
    }
  }

  // Sequência viva: só de quem jogou na última noite que teve jogo. Quem sumiu
  // não fica "em chamas" para sempre com as vitórias de um mês atrás.
  const ultimaNoite = jogos.at(-1)?.sessionId;
  const presentes = new Set<string>();
  for (const match of jogos) {
    if (match.sessionId === ultimaNoite) {
      for (const teamId of [match.teamAId, match.teamBId]) {
        for (const playerId of duplas.get(teamId) ?? []) {
          presentes.add(playerId);
        }
      }
    }
  }
  const viva = new Map([...sequencia.entries()].filter(([playerId]) => presentes.has(playerId)));

  const titulos = new Map<string, number>();
  for (const tournament of tournaments) {
    if (tournament.status !== 'completed' || !naJanela(tournament.sessionId)) {
      continue;
    }
    const campea = tournament.finalStandings.find((standing) => standing.position === 1);
    for (const playerId of duplas.get(campea?.teamId ?? '') ?? []) {
      soma(titulos, playerId);
    }
  }

  const destaque = (match: Match | null): PartidaDestaque | null =>
    match
      ? {
          matchId: match.id,
          tournamentId: match.tournamentId,
          diferenca: match.pointDifference,
          vencedorIds: duplas.get(match.winnerId ?? '') ?? [],
          perdedorIds: duplas.get(match.loserId ?? '') ?? [],
          placar: {
            vencedor: Math.max(match.scoreA, match.scoreB),
            perdedor: Math.min(match.scoreA, match.scoreB),
          },
        }
      : null;

  const maior = (valor: (match: Match) => number) =>
    jogos.reduce<Match | null>(
      (melhor, match) => (!melhor || valor(match) > valor(melhor) ? match : melhor),
      null,
    );

  return {
    maisVitorias: lideres(vitorias),
    maisPontos: lideres(pontos),
    maisTitulos: lideres(titulos),
    // Uma vitória não é sequência.
    emSequencia: lideres(viva, 2),
    // Um jogo junto não é "do coração", e um encontro não é clássico.
    duplaDoCoracao: parMaisFrequente(juntos, 2),
    classico: parMaisFrequente(opostos, 2),
    recordeDeSequencia: lideres(recorde, 2),
    maisElastico: destaque(maior((match) => match.pointDifference)),
    maisDisputado: destaque(maior((match) => match.scoreA + match.scoreB)),
  };
}
