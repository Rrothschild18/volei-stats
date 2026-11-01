import { Match, PendingTiebreak, TiebreakDecision, TiebreakKind } from '../../shared/models';

/**
 * Leitura da rodada 1: quem sobe, quem cai e quando o app não pode decidir
 * (REGRAS.md §9.3).
 *
 * A diferença de pontos é o critério: o vencedor por mais diferença vai direto
 * à final, o perdedor por mais diferença está fora, e o perdedor por menos
 * disputa o par-ou-ímpar do encaixe. Quando duas duplas empatam **na fronteira
 * que decide**, não existe critério: a chave pausa e as duplas resolvem com um
 * par-ou-ímpar, que quem está na quadra registra.
 */

export interface RankedTeam {
  readonly id: string;
  readonly diff: number;
}

export interface Round1Options {
  readonly decisions?: readonly TiebreakDecision[];
  /**
   * Quantas partidas a rodada 1 tem neste formato. Sem a rodada fechada não há
   * fronteira: duas partidas empatadas de três ainda podem ser desempatadas
   * pela terceira.
   */
  readonly expectedMatches?: number;
  /** Com 3º lugar, a segunda posição dos perdedores também decide. */
  readonly thirdPlaceEnabled?: boolean;
}

export interface Round1Outcome {
  /** Vencedores ordenados pela diferença, do maior para o menor. */
  readonly winners: readonly RankedTeam[];
  /** Perdedores ordenados pela diferença, do maior para o menor. */
  readonly losers: readonly RankedTeam[];
  /** Preenchido quando a fronteira empatou e ninguém pode decidir sozinho. */
  readonly needsTiebreak: PendingTiebreak | null;
  /**
   * Decisões guardadas que já não descrevem empate nenhum desta rodada.
   *
   * Aparecem quando uma correção de placar muda quem empatou: o par-ou-ímpar
   * foi feito entre duas duplas que agora não estão mais empatadas entre si.
   * Decisão guardada que ninguém revalida é a fonte do problema, e não a
   * solução — quem a lê daqui tem de apagá-la (ticket 35).
   */
  readonly staleDecisions: readonly TiebreakDecision[];
}

/** A dupla do empate que não venceu o par-ou-ímpar. */
function otherTeam(decision: TiebreakDecision, idA: string, idB: string): string {
  return decision.winnerTeamId === idA ? idB : idA;
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/**
 * A decisão que resolve exatamente este empate: mesmo tipo, e as mesmas duplas.
 *
 * O "as mesmas duplas" é a regra inteira. Uma decisão guardada não vale para
 * um empate novo entre outras duplas — alguém fez aquele par-ou-ímpar entre
 * aqueles dois, e não entre quem a correção de placar colocou ali.
 */
function decisionFor(
  decisions: readonly TiebreakDecision[],
  kind: TiebreakKind,
  teamIds: readonly string[],
): TiebreakDecision | undefined {
  return decisions.find((decision) => decision.kind === kind && sameSet(decision.teamIds, teamIds));
}

function rank(
  entries: readonly RankedTeam[],
  decisions: readonly TiebreakDecision[],
  kind: TiebreakKind,
): RankedTeam[] {
  return [...entries].sort((entryA, entryB) => {
    if (entryB.diff !== entryA.diff) {
      return entryB.diff - entryA.diff;
    }

    // Empate já resolvido na quadra. Entre vencedores, quem ganhou o
    // par-ou-ímpar vai direto à final, então vem primeiro. Entre perdedores é o
    // contrário: quem ganhou disputa o encaixe (a última posição da lista) e
    // quem perdeu é a eliminada direta (a primeira).
    const decision = decisions.find(
      (candidate) =>
        candidate.kind === kind &&
        candidate.teamIds.includes(entryA.id) &&
        candidate.teamIds.includes(entryB.id),
    );

    if (decision) {
      const first =
        kind === 'winners' ? decision.winnerTeamId : otherTeam(decision, entryA.id, entryB.id);
      if (first === entryA.id) return -1;
      if (first === entryB.id) return 1;
    }

    return 0;
  });
}

/**
 * Procura empate nas posições que decidem alguma coisa.
 *
 * Entre vencedores, qualquer par vizinho decide: o primeiro vai direto à final
 * e, nos formatos de três partidas, o segundo entra uma rodada antes do
 * terceiro. Entre perdedores, a primeira posição diz quem está fora, e a
 * segunda só importa quando há disputa de 3º lugar.
 */
function tiesAt(ranked: readonly RankedTeam[], boundaries: readonly number[]): readonly string[][] {
  const groups: string[][] = [];

  for (const index of boundaries) {
    if (index + 1 >= ranked.length) {
      continue;
    }

    if (ranked[index].diff !== ranked[index + 1].diff) {
      continue;
    }

    const { diff } = ranked[index];
    const group = ranked.filter((entry) => entry.diff === diff).map((entry) => entry.id);
    if (!groups.some((known) => sameSet(known, group))) {
      groups.push(group);
    }
  }

  return groups;
}

/** O primeiro empate desta fronteira que ninguém decidiu ainda. */
function pendingAt(
  groups: readonly string[][],
  kind: TiebreakKind,
  decisions: readonly TiebreakDecision[],
): PendingTiebreak | null {
  const open = groups.find((group) => !decisionFor(decisions, kind, group));
  return open ? { kind, teamIds: [...open] } : null;
}

export function readRound1(round1: readonly Match[], options: Round1Options = {}): Round1Outcome {
  const decisions = options.decisions ?? [];

  const winnerEntries = round1
    .filter((match) => match.winnerId)
    .map((match) => ({ id: match.winnerId!, diff: match.pointDifference }));
  const loserEntries = round1
    .filter((match) => match.loserId)
    .map((match) => ({ id: match.loserId!, diff: match.pointDifference }));

  const winners = rank(winnerEntries, decisions, 'winners');
  const losers = rank(loserEntries, decisions, 'losers');

  // A fronteira só existe com a rodada 1 inteira jogada. Enquanto falta
  // partida, um empate ainda pode ser desfeito pelo resultado que vem.
  const complete =
    options.expectedMatches !== undefined
      ? round1.length === options.expectedMatches
      : round1.length >= 2;

  const winnerBoundaries = winners.map((_, index) => index);
  const loserBoundaries = options.thirdPlaceEnabled ? [0, 1] : [0];

  if (!complete) {
    // Rodada pela metade não tem fronteira, e por isso também não tem decisão
    // caduca: o empate que falta uma partida para se desfazer ainda pode voltar
    // a ser o mesmo.
    return { winners, losers, needsTiebreak: null, staleDecisions: [] };
  }

  const loserTies = tiesAt(losers, loserBoundaries);
  const winnerTies = tiesAt(winners, winnerBoundaries);

  const needsTiebreak =
    pendingAt(loserTies, 'losers', decisions) ?? pendingAt(winnerTies, 'winners', decisions);

  const staleDecisions = decisions.filter((decision) => {
    const groups = decision.kind === 'losers' ? loserTies : winnerTies;
    return !groups.some((group) => sameSet(group, decision.teamIds));
  });

  return { winners, losers, needsTiebreak, staleDecisions };
}
