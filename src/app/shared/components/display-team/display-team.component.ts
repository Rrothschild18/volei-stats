import { Component, computed, input } from '@angular/core';

import { Player } from '../../models/player.model';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

export interface DisplayTeam {
  id: string;
  playerIds: readonly [string, string];
}

/**
 * Componente reutilizável para exibir as duplas de um sorteio/campeonato,
 * o jogador em espera (avulso) e, opcionalmente, destacar o campeão e o
 * jogador emprestado que venceu o par-ou-ímpar do encaixe.
 */
@Component({
  selector: 'app-teams-display',
  imports: [MatCardModule, MatIconModule],
  template: `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      @for (team of teams(); track team.id; let i = $index) {
        <mat-card
          [class]="
            team.id === championTeamId() ? 'border-l-4! border-yellow-400! bg-yellow-50!' : ''
          "
        >
          <mat-card-content class="p-3">
            <div class="flex items-center justify-between mb-1">
              <p class="font-medium">Dupla {{ i + 1 }}</p>
              @if (team.id === championTeamId()) {
                <span class="inline-flex items-center gap-1 text-xs font-bold text-yellow-700">
                  <mat-icon class="text-base! w-4! h-4! leading-4!">emoji_events</mat-icon>
                  Campeão
                </span>
              }
            </div>
            <div class="flex flex-col gap-1">
              @for (pid of team.playerIds; track pid) {
                <div class="flex items-center gap-2">
                  <span>{{ playerName(pid) }}</span>
                  @if (pid === borrowedPlayerId()) {
                    <span
                      class="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full px-2 py-0.5"
                    >
                      <mat-icon class="text-sm! w-4! h-4! leading-4!">swap_horiz</mat-icon>
                      Emprestado (encaixe)
                    </span>
                  }
                </div>
              }
            </div>
          </mat-card-content>
        </mat-card>
      }
    </div>

    @if (waitingPlayerId()) {
      <mat-card class="mt-3 border-l-4! border-orange-400!">
        <mat-card-content class="p-3">
          <div class="flex items-center gap-2">
            <mat-icon class="text-orange-500!">hourglass_empty</mat-icon>
            <span class="font-medium">Jogador em espera:</span>
            <span>{{ playerName(waitingPlayerId()!) }}</span>
          </div>
        </mat-card-content>
      </mat-card>
    }
  `,
})
export class TeamsDisplayComponent {
  readonly teams = input<readonly DisplayTeam[]>([]);
  readonly players = input<readonly Player[]>([]);
  readonly waitingPlayerId = input<string | null>(null);
  readonly borrowedPlayerId = input<string | null>(null);
  readonly championTeamId = input<string | null>(null);

  private readonly nameMap = computed(
    () => new Map(this.players().map((player) => [player.id, player.name])),
  );

  playerName(id: string): string {
    return this.nameMap().get(id) ?? 'Desconhecido';
  }
}
