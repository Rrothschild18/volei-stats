import { DrawProposal, Tournament } from '../../shared/models';

/**
 * Revezamento da espera dentro da sessão (REGRAS.md §9.1).
 *
 * Quando o número de presentes é ímpar, alguém fica de avulso. A escolha é
 * aleatória, mas revezada: ninguém espera duas vezes antes de todos esperarem
 * uma. A contagem vale **só para o dia** — histórico de outras sessões não
 * entra, porque a prioridade morre no fim do dia (§9.2).
 */

/**
 * Quantas vezes cada jogador esperou nesta sessão.
 *
 * A espera acontece uma vez por sorteio escolhido: o campeonato criado a partir
 * dele herda o mesmo avulso, então contar os dois duplicaria. Campeonato sem
 * sorteio correspondente (dado antigo) é contado à parte, para não perder a
 * espera de ninguém.
 */
export function countWaitsInSession(
  draws: readonly DrawProposal[],
  tournaments: readonly Tournament[],
): Map<string, number> {
  const counts = new Map<string, number>();
  const countedDrawIds = new Set<string>();

  const add = (playerId: string | null) => {
    if (playerId) {
      counts.set(playerId, (counts.get(playerId) ?? 0) + 1);
    }
  };

  for (const draw of draws) {
    if (!draw.selected) {
      continue;
    }
    countedDrawIds.add(draw.id);
    add(draw.waitingPlayerId);
  }

  for (const tournament of tournaments) {
    if (!countedDrawIds.has(tournament.drawId)) {
      add(tournament.waitingPlayerId);
    }
  }

  return counts;
}

/**
 * Quem pode ficar de espera no próximo sorteio: os presentes, menos os
 * prioritários, restritos aos que esperaram menos vezes hoje.
 *
 * Se todos os presentes forem prioritários, a prioridade cede — alguém tem de
 * esperar para o número fechar.
 */
export function waitingCandidates(
  presentPlayerIds: readonly string[],
  priorityPlayerIds: readonly string[],
  waitCounts: ReadonlyMap<string, number>,
): string[] {
  const priority = new Set(priorityPlayerIds);
  const eligible = presentPlayerIds.filter((playerId) => !priority.has(playerId));
  const pool = eligible.length > 0 ? eligible : [...presentPlayerIds];

  if (pool.length === 0) {
    return [];
  }

  const minWaits = Math.min(...pool.map((playerId) => waitCounts.get(playerId) ?? 0));
  return pool.filter((playerId) => (waitCounts.get(playerId) ?? 0) === minWaits);
}
