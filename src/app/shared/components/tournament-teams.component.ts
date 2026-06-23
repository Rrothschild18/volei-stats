import { Component, input } from '@angular/core';
import { Player } from '../models';

export interface TeamLike {
  id: string;
  playerIds: readonly string[] | string[];
}

@Component({
  selector: 'app-tournament-teams',
  template: `
    <div class="flex flex-col gap-2">
      @for (team of teams(); track team.id; let i = $index) {
        <div class="flex items-center gap-2 p-2 rounded-lg bg-surface-container border border-outline-variant">
          <span class="text-xs font-semibold text-secondary w-16 shrink-0">Dupla {{ i + 1 }}</span>
          <span class="font-medium text-on-surface">{{ getTeamNames(team) }}</span>
        </div>
      }
      @if (waitingPlayer()) {
        <div
          class="flex items-center gap-2 p-2 rounded-lg bg-orange-50 border border-orange-200"
          role="status"
          aria-label="Jogador em espera"
        >
          <span class="text-orange-500 text-lg" aria-hidden="true">⏳</span>
          <span class="text-sm font-medium text-orange-700">Em espera:</span>
          <span class="font-semibold text-orange-800">{{ waitingPlayer()!.name }}</span>
        </div>
      }
    </div>
  `,
})
export class TournamentTeamsComponent {
  teams = input.required<TeamLike[]>();
  players = input.required<Map<string, Player>>();
  waitingPlayer = input<Player | null>(null);

  getTeamNames(team: TeamLike): string {
    return (team.playerIds as string[]).map((pid) => this.players().get(pid)?.name ?? '?').join(' + ');
  }
}
