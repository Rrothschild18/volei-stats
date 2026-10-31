import { Match, OddPlayerPlacement, TournamentTeam } from '../../shared/models';

/**
 * O que é de cada dupla, numa palavra.
 *
 * `fora` cobre quem perdeu qualquer partida que não a final, e também quem
 * VENCEU a disputa de 3º: o campeonato daquela dupla acabou ali, em terceiro.
 */
export type TeamState = 'campea' | 'vice' | 'eliminada-direto' | 'desfeita' | 'fora' | 'em-jogo';

/**
 * O estado de cada dupla, lido das PARTIDAS.
 *
 * Isto não vem de uma marca guardada de propósito. `TournamentTeam.eliminated`
 * existe e é escrito em dois lugares só — a eliminação direta e a dupla
 * desfeita pelo encaixe —, então perder uma partida não marcava nada, e a tela
 * dizia "em jogo" para a campeã, para a vice e para quem tinha caído, para
 * sempre. Um estado derivado que ninguém atualiza é pior que nenhum.
 *
 * A ordem de precedência importa: a eliminação direta é a informação mais dura
 * da tela e não pode ser encoberta pelo "fora" genérico; a dupla desfeita no
 * encaixe não está fora — ela virou outra dupla.
 */
export function teamStates(
  teams: readonly TournamentTeam[],
  matches: readonly Match[],
  placement: OddPlayerPlacement | null,
): ReadonlyMap<string, TeamState> {
  const decididas = matches.filter((match) => match.winnerId !== null);
  const final = decididas.find((match) => match.phase === 'final') ?? null;
  // Perder uma partida que não a final encerra o campeonato da dupla. A
  // disputa de 3º encerra o das DUAS: quem vence é terceiro, quem perde é
  // quarto, e nenhuma das duas volta à quadra.
  const acabou = new Set<string>();
  for (const match of decididas) {
    if (match.phase === 'final') {
      continue;
    }
    acabou.add(match.loserId!);
    if (match.phase === 'third-place') {
      acabou.add(match.winnerId!);
    }
  }

  return new Map(
    teams.map((team) => {
      if (team.eliminatedDirectly) {
        return [team.id, 'eliminada-direto' as const];
      }
      if (placement && team.id === placement.sourceTeamId) {
        return [team.id, 'desfeita' as const];
      }
      if (final && final.winnerId === team.id) {
        return [team.id, 'campea' as const];
      }
      if (final && final.loserId === team.id) {
        return [team.id, 'vice' as const];
      }
      return [team.id, acabou.has(team.id) ? ('fora' as const) : ('em-jogo' as const)];
    }),
  );
}
