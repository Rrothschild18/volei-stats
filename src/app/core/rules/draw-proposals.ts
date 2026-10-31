import { Team } from '../../shared/models';

/**
 * Propostas de sorteio realmente distintas (REGRAS.md §9.7).
 *
 * Antes, as três propostas saíam das três melhores pontuações de 100 tentativas
 * — e as três podiam ser a mesma coisa. Agora cada proposta tem de ser diferente
 * das outras: com número ímpar, uma por avulso distinto; com número par, pelos
 * pares formados.
 */

/**
 * Identidade de uma proposta: os pares (cada um com os jogadores em ordem) mais
 * o avulso. Duas propostas com a mesma chave são a mesma proposta, mesmo que a
 * ordem das duplas na chave seja outra.
 */
export function proposalKey(teams: readonly Team[], waitingPlayerId: string | null): string {
  const pairs = teams
    .map((team) => [...team.playerIds].sort().join('+'))
    .sort()
    .join('|');

  return waitingPlayerId ? `${pairs}#${waitingPlayerId}` : pairs;
}

export interface ProposalShape {
  readonly teams: readonly Team[];
  readonly waitingPlayerId: string | null;
}

/** Mantém a primeira de cada proposta repetida, preservando a ordem recebida. */
export function dedupeProposals<T extends ProposalShape>(proposals: readonly T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const proposal of proposals) {
    const key = proposalKey(proposal.teams, proposal.waitingPlayerId);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(proposal);
  }

  return unique;
}
