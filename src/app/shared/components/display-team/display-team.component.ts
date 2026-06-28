import { Component, computed, input } from '@angular/core';

import { Player } from '../../models/player.model';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TitleCasePipe } from '@angular/common';

export interface DisplayTeam {
  id: string;
  playerIds: readonly [string, string];
  eliminated?: boolean;
  eliminatedDirectly?: boolean;
  synthetic?: boolean;
}

/**
 * Componente reutilizável para exibir as duplas de um sorteio/campeonato,
 * o jogador em espera (avulso) e, opcionalmente, destacar o campeão e o
 * jogador emprestado que venceu o par-ou-ímpar do encaixe.
 */
@Component({
  selector: 'app-teams-display',
  imports: [MatCardModule, MatIconModule, TitleCasePipe],
  template: `
    @if (waitingPlayerId()) {
      <div
        class="w-full bg-secondary-container/10 rounded-xl p-3 flex items-center gap-3 border border-secondary-container/20 mb-4"
      >
        <div
          class="w-10 h-10 bg-secondary-container/75 text-on-secondary-container rounded-full flex items-center justify-center shrink-0"
        >
          <span class="material-symbols-outlined text-2xl">hourglass_empty</span>
        </div>
        <div class="flex flex-col">
          <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider"
            >Jogador em espera</span
          >
          <span class="text-md font-medium text-on-surface-variant">{{
            playerName(waitingPlayerId()!)
          }}</span>
        </div>
      </div>
    }
    <div class="grid grid-cols-2 sm:grid-cols-2 gap-3">
      @for (team of teams(); track team.id; let i = $index) {
        <!-- <mat-card
          [class]="
            team.id === championTeamId()
              ? 'border-l-4! border-yellow-400! bg-yellow-50!'
              : team.eliminatedDirectly
                ? 'border-l-4! border-red-400! bg-red-50!'
                : ''
          "
        >
          <mat-card-content class="p-3">
            <div class="flex items-center justify-between mb-1 gap-2">
              <p class="font-medium">Dupla {{ i + 1 }}</p>
              @if (team.id === championTeamId()) {
                <span class="inline-flex items-center gap-1 text-xs font-bold text-yellow-700">
                  <mat-icon class="text-base! w-4! h-4! leading-4!">emoji_events</mat-icon>
                  Campeão
                </span>
              } @else if (team.eliminatedDirectly) {
                <span
                  class="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 rounded-full px-2 py-0.5"
                >
                  <mat-icon class="text-sm! w-4! h-4! leading-4!">block</mat-icon>
                  Eliminada (mais pontos)
                </span>
              } @else if (team.eliminated && !team.synthetic) {
                <span
                  class="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2 py-0.5"
                >
                  Desfeita no encaixe
                </span>
              }
            </div>
            <div class="flex flex-col gap-1">
              @for (pid of team.playerIds; track pid) {
                <div class="flex items-center gap-2">
                  <span>{{ playerName(pid) }}</span>
                </div>
              }
            </div>
            @if (showCoinFlipWinner(team)) {
              <div class="flex justify-center mt-2">
                <span
                  class="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5"
                >
                  <mat-icon class="text-sm! w-4! h-4! leading-4!">handshake</mat-icon>
                  {{ playerName(coinFlipWinnerId()!) }} venceu o par-ou-ímpar
                </span>
              </div>
            }
          </mat-card-content>
        </mat-card> -->

        <section
          class="aspect-square w-full rounded-lg border border-outline-variant/50 bg-white p-4 flex flex-col"
        >
          <div class="flex flex-col gap-4">
            <!-- <mat-icon
              class="text-primary size-10 inline-flex items-center justify-center rounded-xl"
              >trending_up</mat-icon
            > -->
            <div class="">
              <span
                class="text-primary font-bold text-xs uppercase tracking-wide bg-primary-container/10 px-3 py-1 rounded-full inline-block"
              >
                Dupla #0{{ i + 1 }}
              </span>
            </div>
            <div class="flex gap-1 flex-col">
              <div class="flex min-w-0 gap-2">
                <span class="min-w-6 truncate font-title-lg font-bold text-primary"
                  >{{ playerName(team.playerIds[0]) }}
                </span>

                <span class="shrink-0 font-title-lg font-bold text-primary"> / </span>

                <span class="min-w-4 truncate font-title-lg font-bold text-primary text-right">
                  {{ playerName(team.playerIds[1]) }}
                </span>
              </div>

              <div class="flex -space-x-3">
                <div
                  class="w-12 h-12 rounded-full border-2 border-surface-container-lowest bg-primary-container/10 flex items-center justify-center text-on-surface-variant font-bold"
                >
                  {{ playerName(team.playerIds[0]).charAt(0) | titlecase }}
                </div>
                <div
                  class="w-12 h-12 rounded-full border-2 border-surface-container-lowest bg-primary-container/50 flex items-center justify-center text-on-surface-variant font-bold"
                >
                  {{ playerName(team.playerIds[1]).charAt(0) | titlecase }}
                </div>
              </div>
            </div>

            <!-- <p class="text-sm text-on-surface-variant">Melhor % ({{ 0 }}%)</p> -->
          </div>
        </section>
      }
    </div>
  `,
})
export class TeamsDisplayComponent {
  readonly teams = input<readonly DisplayTeam[]>([]);
  readonly players = input<readonly Player[]>([]);
  readonly waitingPlayerId = input<string | null>(null);
  /** Jogador que venceu o par-ou-ímpar e formou a dupla do encaixe. */
  readonly coinFlipWinnerId = input<string | null>(null);
  readonly championTeamId = input<string | null>(null);
  readonly borrowedPlayerId = input<string | null>(null);

  private readonly nameMap = computed(
    () => new Map(this.players().map((player) => [player.id, player.name])),
  );

  playerName(id: string): string {
    return this.nameMap().get(id) ?? 'Desconhecido';
  }

  showCoinFlipWinner(team: DisplayTeam): boolean {
    const winnerId = this.coinFlipWinnerId();
    return !!winnerId && !!team.synthetic && team.playerIds.includes(winnerId);
  }
}
