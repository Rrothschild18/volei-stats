import { MatchPhase } from '../../shared/models';
import { TournamentFormat } from './tournament-format.model';

/**
 * As fases de um formato, na ordem em que são jogadas.
 *
 * O `TournamentService` gera uma partida por vez, olhando o que já aconteceu.
 * A escada da tela precisa do caminho inteiro — inclusive os degraus que ainda
 * não têm dupla definida, que aparecem como "VENCEDOR". É a mesma sequência que
 * o chaveamento segue; a tabela de formatos (REGRAS.md §10) diz o total de
 * partidas, e o teste confere que as duas contas batem.
 */
export function plannedPhases(format: TournamentFormat): MatchPhase[] {
  const phases = basePhases(format.teamCount, format.usesWaitingPlayer);

  if (format.thirdPlaceDefault) {
    // A disputa de 3º lugar é jogada antes da final.
    const finalIndex = phases.lastIndexOf('final');
    phases.splice(finalIndex, 0, 'third-place');
  }

  return phases;
}

function basePhases(teamCount: number, usesWaitingPlayer: boolean): MatchPhase[] {
  const round1 = (count: number): MatchPhase[] => Array.from({ length: count }, () => 'round-1');

  if (usesWaitingPlayer) {
    switch (teamCount) {
      case 3:
        return [...round1(1), 'semifinal-bye', 'final'];
      case 4:
        return [...round1(2), 'semifinal', 'final'];
      case 5:
        return [...round1(2), 'semifinal-bye', 'semifinal', 'final'];
      default:
        return [];
    }
  }

  switch (teamCount) {
    case 2:
      return ['final'];
    case 3:
      return [...round1(1), 'semifinal', 'final'];
    case 4:
      return ['semifinal', 'semifinal', 'final'];
    case 5:
      return [...round1(2), 'semifinal-bye', 'final'];
    case 6:
      return [...round1(3), 'semifinal', 'final'];
    case 7:
      return [...round1(3), 'semifinal-bye', 'semifinal', 'final'];
    default:
      return [];
  }
}

const PHASE_LABELS: Record<MatchPhase, string> = {
  'round-1': 'Rodada 1',
  'semifinal-bye': 'Semifinal (bye)',
  semifinal: 'Semifinal',
  final: 'Final',
  'third-place': 'Disputa de 3º',
};

export function phaseLabel(phase: MatchPhase): string {
  return PHASE_LABELS[phase];
}
