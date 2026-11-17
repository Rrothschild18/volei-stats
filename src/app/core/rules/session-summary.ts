import { Match, Tournament } from '../../shared/models';

/**
 * O resumo esportivo da noite (ticket 02): o que vale um "parabéns" no grupo,
 * e não uma classificação.
 *
 * Tudo aqui é da SESSÃO, e zera na próxima. É o contrapeso do mural, que
 * acumula: num contador que só sobe, quem começou hoje fica no fim da lista
 * para sempre — aqui qualquer um aparece no primeiro dia.
 *
 * Empate não é desfeito: os empatados vêm juntos em `playerIds`. Desempatar
 * por um critério inventado seria escolher um vencedor que a quadra não
 * escolheu.
 */
export interface DestaqueDeJogadores {
  readonly playerIds: readonly string[];
  readonly valor: number;
}

export interface EntradaDoResumo {
  readonly tournaments: readonly Tournament[];
  readonly matches: readonly Match[];
}

/** O pódio de um jogador na noite: quantas vezes ele terminou entre os três. */
export interface PodioDaNoite {
  readonly playerId: string;
  readonly valor: number;
}

/** O campeão de um dos campeonatos da noite, com o placar da final. */
export interface CampeaoDaNoite {
  readonly tournamentId: string;
  readonly nome: string;
  readonly playerIds: readonly string[];
  /** Nulo quando a final não foi lançada — campeonato encerrado na mão. */
  readonly placar: { readonly vencedor: number; readonly perdedor: number } | null;
}

/** A partida que o grupo vai lembrar: a que quase virou. */
export interface PartidaDestaque {
  readonly matchId: string;
  readonly tournamentId: string;
  readonly diferenca: number;
  readonly vencedorIds: readonly string[];
  readonly perdedorIds: readonly string[];
  readonly placar: { readonly vencedor: number; readonly perdedor: number };
}

export interface ResumoDaSessao {
  readonly partidas: number;
  readonly maisVitorias: DestaqueDeJogadores | null;
  readonly maiorSequencia: DestaqueDeJogadores | null;
  readonly maisTitulos: DestaqueDeJogadores | null;
  readonly podios: readonly PodioDaNoite[];
  readonly campeoes: readonly CampeaoDaNoite[];
  /** Os jogadores da última partida da noite — os quatro, não só quem venceu. */
  readonly fechouAQuadra: readonly string[];
  readonly maisApertada: PartidaDestaque | null;
  /**
   * Minutos por partida, ESTIMADOS: `played_at` é quando o placar foi
   * lançado, não quando a partida começou, e o intervalo entre dois
   * lançamentos inclui a conversa, a água e a troca de quadra. Só conta
   * intervalo dentro do mesmo campeonato — entre campeonatos o buraco é o
   * sorteio seguinte. A tela precisa dizer que é estimativa.
   */
  readonly duracaoMediaMin: number | null;
}

/** Até onde vai o pódio. Quarto lugar não é pódio em lugar nenhum. */
const PODIO = 3;

/** As duplas de todos os campeonatos da noite, por id. */
function duplasPorId(tournaments: readonly Tournament[]): Map<string, readonly string[]> {
  const duplas = new Map<string, readonly string[]>();
  for (const tournament of tournaments) {
    for (const team of tournament.teams) {
      duplas.set(team.id, team.playerIds);
    }
  }
  return duplas;
}

/** As partidas lançadas, da primeira para a última. */
function emOrdem(matches: readonly Match[]): Match[] {
  return matches
    .filter((match) => !!match.winnerId)
    .sort((a, b) => a.playedAt.localeCompare(b.playedAt));
}

/** Quem está em cima, com os empatados juntos. Nulo se ninguém pontuou. */
function lideres(contagem: ReadonlyMap<string, number>): DestaqueDeJogadores | null {
  let valor = 0;
  for (const quanto of contagem.values()) {
    valor = Math.max(valor, quanto);
  }

  if (valor === 0) {
    return null;
  }

  const playerIds = [...contagem.entries()]
    .filter(([, quanto]) => quanto === valor)
    .map(([playerId]) => playerId)
    .sort();

  return { playerIds, valor };
}

export function resumoDaSessao({ tournaments, matches }: EntradaDoResumo): ResumoDaSessao {
  const duplas = duplasPorId(tournaments);
  const jogos = emOrdem(matches);

  const vitorias = new Map<string, number>();
  const sequenciaAtual = new Map<string, number>();
  const maiorSequencia = new Map<string, number>();

  for (const match of jogos) {
    for (const teamId of [match.teamAId, match.teamBId]) {
      const venceu = match.winnerId === teamId;
      for (const playerId of duplas.get(teamId) ?? []) {
        if (venceu) {
          vitorias.set(playerId, (vitorias.get(playerId) ?? 0) + 1);
          const seguidas = (sequenciaAtual.get(playerId) ?? 0) + 1;
          sequenciaAtual.set(playerId, seguidas);
          maiorSequencia.set(playerId, Math.max(maiorSequencia.get(playerId) ?? 0, seguidas));
        } else {
          sequenciaAtual.set(playerId, 0);
        }
      }
    }
  }

  const titulos = new Map<string, number>();
  const podios = new Map<string, number>();
  const campeoes: CampeaoDaNoite[] = [];

  // `finalStandings` só existe em campeonato concluído: o que está rolando não
  // tem campeão, e anunciar um seria anunciar o que ainda pode mudar.
  for (const tournament of tournaments) {
    if (tournament.status !== 'completed') {
      continue;
    }

    for (const standing of tournament.finalStandings) {
      const playerIds = duplas.get(standing.teamId) ?? [];
      for (const playerId of playerIds) {
        if (standing.position === 1) {
          titulos.set(playerId, (titulos.get(playerId) ?? 0) + 1);
        }
        if (standing.position <= PODIO) {
          podios.set(playerId, (podios.get(playerId) ?? 0) + 1);
        }
      }

      if (standing.position === 1) {
        const final = jogos.find(
          (match) => match.tournamentId === tournament.id && match.phase === 'final',
        );

        campeoes.push({
          tournamentId: tournament.id,
          nome: tournament.name,
          playerIds,
          placar: final
            ? {
                vencedor: Math.max(final.scoreA, final.scoreB),
                perdedor: Math.min(final.scoreA, final.scoreB),
              }
            : null,
        });
      }
    }
  }

  const ultima = jogos.at(-1);
  const fechouAQuadra = ultima
    ? [...(duplas.get(ultima.teamAId) ?? []), ...(duplas.get(ultima.teamBId) ?? [])].sort()
    : [];

  // Menor diferença; empate fica com a mais antiga, para a escolha não mudar
  // de uma carga para outra.
  const apertada = jogos.reduce<Match | null>((melhor, match) => {
    if (!melhor) {
      return match;
    }
    return match.pointDifference < melhor.pointDifference ? match : melhor;
  }, null);

  const maisApertada: PartidaDestaque | null = apertada
    ? {
        matchId: apertada.id,
        tournamentId: apertada.tournamentId,
        diferenca: apertada.pointDifference,
        vencedorIds: duplas.get(apertada.winnerId ?? '') ?? [],
        perdedorIds: duplas.get(apertada.loserId ?? '') ?? [],
        placar: {
          vencedor: Math.max(apertada.scoreA, apertada.scoreB),
          perdedor: Math.min(apertada.scoreA, apertada.scoreB),
        },
      }
    : null;

  const intervalos: number[] = [];
  for (const tournament of tournaments) {
    const doCampeonato = jogos.filter((match) => match.tournamentId === tournament.id);
    for (let i = 1; i < doCampeonato.length; i++) {
      const antes = Date.parse(doCampeonato[i - 1].playedAt);
      const depois = Date.parse(doCampeonato[i].playedAt);
      if (Number.isFinite(antes) && Number.isFinite(depois) && depois > antes) {
        intervalos.push((depois - antes) / 60000);
      }
    }
  }

  return {
    partidas: jogos.length,
    maisVitorias: lideres(vitorias),
    maiorSequencia: lideres(maiorSequencia),
    maisTitulos: lideres(titulos),
    podios: [...podios.entries()]
      .map(([playerId, valor]) => ({ playerId, valor }))
      .sort((a, b) => b.valor - a.valor || a.playerId.localeCompare(b.playerId)),
    campeoes,
    fechouAQuadra,
    maisApertada,
    duracaoMediaMin:
      intervalos.length > 0
        ? Math.round(intervalos.reduce((soma, valor) => soma + valor, 0) / intervalos.length)
        : null,
  };
}
