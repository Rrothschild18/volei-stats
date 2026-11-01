import { DrawProposal, Tournament } from '../../shared/models';

/**
 * O sorteio pendente: o próximo campeonato já sorteado, e ainda sem campeonato
 * (ticket 36).
 *
 * Não precisa de coluna nova. `useProposal()` já grava a proposta escolhida com
 * `selected` e já a põe na sessão; o campeonato é que só nasce na tela de
 * formato, apontando para ela com `drawId`. Então **sorteio pendente = sorteio
 * escolhido da sessão que nenhum campeonato está usando** — puro derivado, sem
 * migration, e sem o risco de dois campeonatos `'in-progress'` no mesmo dia.
 *
 * Sorteio órfão já existia antes disto: quem toca em USAR PROPOSTA e volta da
 * tela de formato deixa um. Por isso vale só o mais recente, e a tela onde ele
 * aparece dá como descartar.
 */
export function pendingDraw(
  draws: readonly DrawProposal[],
  tournaments: readonly Tournament[],
): DrawProposal | null {
  const used = new Set(tournaments.map((tournament) => tournament.drawId));

  return (
    draws
      .filter((draw) => draw.selected && !used.has(draw.id))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .at(-1) ?? null
  );
}

/** Quem o sorteio colocou em quadra, contando o avulso. */
export function drawPlayerIds(draw: DrawProposal): string[] {
  const playing = draw.teams.flatMap((team) => [...team.playerIds]);
  return draw.waitingPlayerId ? [...playing, draw.waitingPlayerId] : playing;
}

/**
 * A diferença entre o sorteio pendente e a presença de agora: alguém foi
 * embora, alguém chegou. Um sorteio tirado durante a final aponta para a
 * presença daquele momento, e ela muda.
 */
export interface DrawPresenceDiff {
  /** Está no sorteio e não está mais presente. */
  readonly gone: readonly string[];
  /** Está presente e ficou fora do sorteio. */
  readonly arrived: readonly string[];
}

export function drawPresenceDiff(
  draw: DrawProposal,
  presentIds: readonly string[],
): DrawPresenceDiff {
  const drawn = new Set(drawPlayerIds(draw));
  const present = new Set(presentIds);

  return {
    gone: [...drawn].filter((playerId) => !present.has(playerId)),
    arrived: [...present].filter((playerId) => !drawn.has(playerId)),
  };
}

/** O sorteio pendente ainda descreve quem está na quadra. */
export function presenceUnchanged(diff: DrawPresenceDiff): boolean {
  return diff.gone.length === 0 && diff.arrived.length === 0;
}
