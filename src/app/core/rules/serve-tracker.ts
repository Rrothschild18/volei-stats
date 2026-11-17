/**
 * De quem é o saque (ticket 08).
 *
 * A regra da quadra: a dupla que ganha o rali saca. O mesmo jogador continua
 * sacando enquanto a dupla pontua; quando ela perde a posse e depois a
 * recupera, saca o OUTRO jogador da dupla.
 *
 * Do placar sozinho isso não sai — 12 × 10 pode ter sido milhares de sequências
 * diferentes, e cada uma deixa o saque num lugar. Sai da ORDEM dos pontos, que
 * é o que a folha de placar guarda a cada toque no `+`.
 */
export interface Sacador {
  readonly teamId: string;
  readonly playerId: string;
}

export function sacadorAtual(entrada: {
  /** Quem abriu sacando; vem do par-ou-ímpar. Nulo = ninguém registrou. */
  firstServerTeamId: string | null;
  playersOfTeam: (teamId: string) => readonly string[];
  /** Quem saca PRIMEIRO em cada dupla, quando a quadra disse. O padrão é o primeiro nome. */
  firstServerOf: Readonly<Record<string, string>>;
  /** A dupla que ganhou cada rali, na ordem. */
  rallies: readonly string[];
}): Sacador | null {
  const { firstServerTeamId, playersOfTeam, firstServerOf, rallies } = entrada;
  if (!firstServerTeamId) {
    return null;
  }

  /** Quantas vezes cada dupla já assumiu o saque: par = primeiro sacador, ímpar = o outro. */
  const turnos = new Map<string, number>();

  const sacadorDoTurno = (teamId: string): string | null => {
    const jogadores = playersOfTeam(teamId);
    if (jogadores.length === 0) {
      return null;
    }
    const primeiro = firstServerOf[teamId] ?? jogadores[0];
    const outro = jogadores.find((playerId) => playerId !== primeiro) ?? primeiro;
    return (turnos.get(teamId) ?? 0) % 2 === 0 ? primeiro : outro;
  };

  let sacando = firstServerTeamId;

  for (const vencedor of rallies) {
    if (vencedor !== sacando) {
      // Quem sacava perdeu a posse: o turno dele acabou, e na volta saca o outro.
      turnos.set(sacando, (turnos.get(sacando) ?? 0) + 1);
      sacando = vencedor;
    }
  }

  const playerId = sacadorDoTurno(sacando);
  return playerId ? { teamId: sacando, playerId } : null;
}

/**
 * A sequência de ralis depois de uma mudança de placar na folha.
 *
 * `+1` é um rali ganho; `−1` desfaz o último rali daquela dupla (toque errado).
 * Qualquer salto maior quebra a sequência — quem digita 12 de uma vez não disse
 * em que ordem os pontos saíram — e a resposta honesta passa a ser "não sei"
 * (`null`), que apaga a bola em vez de apontar o sacador errado.
 */
export function ralisDoPlacar(
  rallies: readonly string[] | null,
  mudanca: { teamId: string; antes: number; depois: number },
): string[] | null {
  if (rallies === null) {
    return null;
  }

  const delta = mudanca.depois - mudanca.antes;

  if (delta === 1) {
    return [...rallies, mudanca.teamId];
  }

  if (delta === -1) {
    const ultimo = rallies.lastIndexOf(mudanca.teamId);
    return ultimo >= 0 ? rallies.filter((_, indice) => indice !== ultimo) : null;
  }

  return delta === 0 ? [...rallies] : null;
}

/**
 * A sequência no formato do banco: 0 = a primeira dupla ganhou o rali, 1 = a
 * segunda. Só sai quando a contagem bate com o placar — sequência que não fecha
 * com o número salvo é sequência errada, e guardar errado é pior que não
 * guardar.
 */
export function ralisParaGravar(
  rallies: readonly string[] | null,
  placar: { teamAId: string; scoreA: number; scoreB: number },
): number[] | null {
  if (!rallies) {
    return null;
  }

  const log = rallies.map((teamId) => (teamId === placar.teamAId ? 0 : 1));
  const pontosDeA = log.filter((lado) => lado === 0).length;

  return pontosDeA === placar.scoreA && log.length - pontosDeA === placar.scoreB ? log : null;
}
