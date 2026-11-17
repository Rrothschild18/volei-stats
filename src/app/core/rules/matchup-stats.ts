import { Match, Tournament } from '../../shared/models';

/**
 * O que as duas duplas de uma partida já fizeram (ticket 01): o slider da
 * folha de placar.
 *
 * Tudo sobre o histórico inteiro do vôlei, e não sobre a janela das últimas
 * noites: o sorteio evita repetir dupla, então uma dupla joga junta poucas
 * vezes, e recortar em 4 noites deixaria os cartões vazios.
 *
 * A dupla é o PAR de jogadores, não o id da dupla — a mesma dupla sorteada em
 * dias diferentes é a mesma dupla.
 */
export interface HistoricoDaDupla {
  readonly jogos: number;
  readonly vitorias: number;
  /** Pontos feitos e levados por jogo; nulos quando a dupla nunca jogou junta. */
  readonly mediaPro: number | null;
  readonly mediaContra: number | null;
}

/** Dois jogadores, um de cada lado, e quantas vezes já estiveram em lados opostos. */
export interface Cruzamento {
  readonly playerA: string;
  readonly playerB: string;
  readonly jogos: number;
  readonly vitoriasDeA: number;
}

export interface HistoricoDoConfronto {
  readonly duplaA: HistoricoDaDupla;
  readonly duplaB: HistoricoDaDupla;
  /** Estas duas duplas, uma contra a outra. Quase sempre zero: o sorteio evita. */
  readonly confrontos: number;
  readonly vitoriasDeA: number;
  readonly vitoriasDeB: number;
  /** Os quatro cruzamentos individuais, do mais frequente para o menos. */
  readonly cruzamentos: readonly Cruzamento[];
}

const par = (playerIds: readonly string[]) => [...playerIds].sort().join('|');

export function historicoDoConfronto(entrada: {
  matches: readonly Match[];
  tournaments: readonly Tournament[];
  teamA: readonly string[];
  teamB: readonly string[];
}): HistoricoDoConfronto {
  const { matches, tournaments, teamA, teamB } = entrada;

  const duplas = new Map<string, readonly string[]>();
  for (const tournament of tournaments) {
    for (const team of tournament.teams) {
      duplas.set(team.id, team.playerIds);
    }
  }

  const chaveA = par(teamA);
  const chaveB = par(teamB);
  const somaA = { jogos: 0, vitorias: 0, pro: 0, contra: 0 };
  const somaB = { jogos: 0, vitorias: 0, pro: 0, contra: 0 };
  let confrontos = 0;
  let vitoriasDeA = 0;
  let vitoriasDeB = 0;

  const cruzamentos = new Map<
    string,
    { playerA: string; playerB: string; jogos: number; vitoriasDeA: number }
  >();
  for (const playerA of teamA) {
    for (const playerB of teamB) {
      cruzamentos.set(`${playerA}|${playerB}`, { playerA, playerB, jogos: 0, vitoriasDeA: 0 });
    }
  }

  for (const match of matches) {
    if (!match.winnerId) {
      continue;
    }

    const lados = [
      { teamId: match.teamAId, pro: match.scoreA, contra: match.scoreB },
      { teamId: match.teamBId, pro: match.scoreB, contra: match.scoreA },
    ].map((lado) => ({
      ...lado,
      jogadores: duplas.get(lado.teamId) ?? [],
      venceu: match.winnerId === lado.teamId,
    }));

    for (const lado of lados) {
      const chave = par(lado.jogadores);
      const soma = chave === chaveA ? somaA : chave === chaveB ? somaB : null;
      if (soma) {
        soma.jogos++;
        soma.pro += lado.pro;
        soma.contra += lado.contra;
        if (lado.venceu) {
          soma.vitorias++;
        }
      }
    }

    const chaves = lados.map((lado) => par(lado.jogadores));
    if (chaves.includes(chaveA) && chaves.includes(chaveB) && chaveA !== chaveB) {
      confrontos++;
      const ladoA = lados[chaves.indexOf(chaveA)];
      if (ladoA.venceu) {
        vitoriasDeA++;
      } else {
        vitoriasDeB++;
      }
    }

    // Jogador × jogador: um de cada dupla de hoje, em lados opostos naquele jogo.
    const [primeiro, segundo] = lados;
    for (const cruzamento of cruzamentos.values()) {
      const aNoPrimeiro = primeiro.jogadores.includes(cruzamento.playerA);
      const aNoSegundo = segundo.jogadores.includes(cruzamento.playerA);
      const bNoPrimeiro = primeiro.jogadores.includes(cruzamento.playerB);
      const bNoSegundo = segundo.jogadores.includes(cruzamento.playerB);

      if (aNoPrimeiro && bNoSegundo) {
        cruzamento.jogos++;
        cruzamento.vitoriasDeA += primeiro.venceu ? 1 : 0;
      } else if (aNoSegundo && bNoPrimeiro) {
        cruzamento.jogos++;
        cruzamento.vitoriasDeA += segundo.venceu ? 1 : 0;
      }
    }
  }

  const fechar = (soma: typeof somaA): HistoricoDaDupla => ({
    jogos: soma.jogos,
    vitorias: soma.vitorias,
    mediaPro: soma.jogos > 0 ? Math.round((10 * soma.pro) / soma.jogos) / 10 : null,
    mediaContra: soma.jogos > 0 ? Math.round((10 * soma.contra) / soma.jogos) / 10 : null,
  });

  return {
    duplaA: fechar(somaA),
    duplaB: fechar(somaB),
    confrontos,
    vitoriasDeA,
    vitoriasDeB,
    cruzamentos: [...cruzamentos.values()]
      .filter((cruzamento) => cruzamento.jogos > 0)
      .sort((a, b) => b.jogos - a.jogos || a.playerA.localeCompare(b.playerA)),
  };
}
