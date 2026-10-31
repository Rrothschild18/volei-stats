import { Match, PendingTiebreak, TiebreakDecision, TiebreakKind } from '../../shared/models';

/**
 * Leitura da rodada 1: quem sobe, quem cai e quando o app não pode decidir
 * (REGRAS.md §9.3).
 *
 * A diferença de pontos é o critério: o vencedor por mais diferença vai direto
 * à final, o perdedor por mais diferença está fora, e o perdedor por menos
 * disputa o par-ou-ímpar do encaixe. Quando duas duplas empatam **na fronteira
 * que decide**, não existe critério: a chave pausa e as duplas resolvem com um
 * par-ou-ímpar, que um admin registra.
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
}

/** A dupla do empate que não venceu o par-ou-ímpar. */
function otherTeam(decision: TiebreakDecision, idA: string, idB: string): string {
  return decision.winnerTeamId === idA ? idB : idA;
}

function rank(
  entries: readonly RankedTeam[],
  decisions: readonly TiebreakDecision[],
  kind: TiebreakKind,
): RankedTeam[] {
  const decision = decisions.find((entry) => entry.kind === kind);

  return [...entries].sort((entryA, entryB) => {
    if (entryB.diff !== entryA.diff) {
      return entryB.diff - entryA.diff;
    }

    // Empate já resolvido na quadra. Entre vencedores, quem ganhou o
    // par-ou-ímpar vai direto à final, então vem primeiro. Entre perdedores é o
    // contrário: quem ganhou disputa o encaixe (a última posição da lista) e
    // quem perdeu é a eliminada direta (a primeira).
    if (decision && decision.teamIds.includes(entryA.id) && decision.teamIds.includes(entryB.id)) {
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
function tiebreakAt(
  ranked: readonly RankedTeam[],
  kind: TiebreakKind,
  decisions: readonly TiebreakDecision[],
  boundaries: readonly number[],
): PendingTiebreak | null {
  if (decisions.some((decision) => decision.kind === kind)) {
    return null;
  }

  for (const index of boundaries) {
    if (index + 1 >= ranked.length) {
      continue;
    }

    if (ranked[index].diff === ranked[index + 1].diff) {
      const diff = ranked[index].diff;
      return {
        kind,
        teamIds: ranked.filter((entry) => entry.diff === diff).map((entry) => entry.id),
      };
    }
  }

  return null;
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

  const needsTiebreak = !complete
    ? null
    : (tiebreakAt(losers, 'losers', decisions, loserBoundaries) ??
      tiebreakAt(winners, 'winners', decisions, winnerBoundaries));

  return { winners, losers, needsTiebreak };
}
