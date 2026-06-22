import { Component, inject, signal, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe } from '@angular/common';
import { AppFacade } from '../../../core/facade/app.facade';
import { Match, Player } from '../../../shared/models';

interface MatchDisplay {
  match: Match;
  teamANames: string;
  teamBNames: string;
  winnerNames: string;
  loserNames: string;
  phaseLabel: string;
  playerIds: string[];
}

@Component({
  selector: 'app-history-list',
  imports: [
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    DatePipe,
  ],
  template: `
    <div class="p-4 max-w-4xl mx-auto">
      <h1 class="text-2xl font-bold mb-4">Histórico de Partidas</h1>

      <div class="flex flex-wrap gap-3 mb-4">
        <mat-form-field appearance="outline" class="w-48">
          <mat-label>Período</mat-label>
          <mat-select [value]="periodFilter()" (selectionChange)="onPeriodChange($event.value)">
            <mat-option value="all">Todo período</mat-option>
            <mat-option value="today">Hoje</mat-option>
            <mat-option value="7days">Últimos 7 dias</mat-option>
            <mat-option value="30days">Últimos 30 dias</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="w-48">
          <mat-label>Jogador</mat-label>
          <mat-select [value]="playerFilter()" (selectionChange)="onPlayerChange($event.value)">
            <mat-option value="">Todos</mat-option>
            @for (player of allPlayers(); track player.id) {
              <mat-option [value]="player.id">{{ player.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      @if (filteredMatches().length === 0) {
        <p class="text-center text-gray-500 mt-8">Nenhuma partida encontrada.</p>
      }

      <div class="flex flex-col gap-2">
        @for (item of filteredMatches(); track item.match.id) {
          <mat-card>
            <mat-card-content class="p-3">
              <div class="flex justify-between items-start">
                <div>
                  <span class="text-xs text-gray-500"
                    >{{ item.match.playedAt | date: 'dd/MM/yyyy HH:mm' }} •
                    {{ item.phaseLabel }}</span
                  >
                  <p class="font-medium mt-1">
                    {{ item.teamANames }}
                    <span class="mx-2 font-bold"
                      >{{ item.match.scoreA }} x {{ item.match.scoreB }}</span
                    >
                    {{ item.teamBNames }}
                  </p>
                </div>
                <mat-chip class="text-xs bg-green-100 text-green-700">
                  {{ item.winnerNames }}
                </mat-chip>
              </div>
            </mat-card-content>
          </mat-card>
        }
      </div>
    </div>
  `,
})
export class HistoryListComponent implements OnInit {
  private facade = inject(AppFacade);

  allMatches = signal<MatchDisplay[]>([]);
  allPlayers = signal<Player[]>([]);
  periodFilter = signal('all');
  playerFilter = signal('');
  filteredMatches = signal<MatchDisplay[]>([]);

  async ngOnInit() {
    const [matches, players, tournaments] = await Promise.all([
      this.facade.getMatches(),
      this.facade.getPlayers(),
      this.facade.getTournaments(),
    ]);

    this.allPlayers.set(players);
    const playerMap = new Map(players.map((p) => [p.id, p]));
    const tournamentMap = new Map(tournaments.map((t) => [t.id, t]));

    const displays: MatchDisplay[] = matches
      .filter((m) => m.winnerId)
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt))
      .map((match) => {
        const tournament = tournamentMap.get(match.tournamentId);
        const teamA = tournament?.teams.find((t) => t.id === match.teamAId);
        const teamB = tournament?.teams.find((t) => t.id === match.teamBId);
        const winner = tournament?.teams.find((t) => t.id === match.winnerId);
        const loser = tournament?.teams.find((t) => t.id === match.loserId);

        return {
          match,
          teamANames: teamA
            ? teamA.playerIds.map((id) => playerMap.get(id)?.name || '?').join(' + ')
            : '?',
          teamBNames: teamB
            ? teamB.playerIds.map((id) => playerMap.get(id)?.name || '?').join(' + ')
            : '?',
          winnerNames: winner
            ? winner.playerIds.map((id) => playerMap.get(id)?.name || '?').join(' + ')
            : '?',
          loserNames: loser
            ? loser.playerIds.map((id) => playerMap.get(id)?.name || '?').join(' + ')
            : '?',
          phaseLabel: this.getPhaseLabel(match.phase),
          playerIds: [...(teamA?.playerIds || []), ...(teamB?.playerIds || [])],
        };
      });

    this.allMatches.set(displays);
    this.applyFilters();
  }

  onPeriodChange(value: string) {
    this.periodFilter.set(value);
    this.applyFilters();
  }

  onPlayerChange(value: string) {
    this.playerFilter.set(value);
    this.applyFilters();
  }

  private applyFilters() {
    let results = [...this.allMatches()];

    const now = new Date();
    const period = this.periodFilter();
    if (period === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      results = results.filter((r) => r.match.playedAt.startsWith(todayStr));
    } else if (period === '7days') {
      const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      results = results.filter((r) => r.match.playedAt >= cutoff);
    } else if (period === '30days') {
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      results = results.filter((r) => r.match.playedAt >= cutoff);
    }

    const playerId = this.playerFilter();
    if (playerId) {
      results = results.filter((r) => r.playerIds.includes(playerId));
    }

    this.filteredMatches.set(results);
  }

  private getPhaseLabel(phase: string): string {
    switch (phase) {
      case 'round-1':
        return 'Rodada 1';
      case 'semifinal':
        return 'Semifinal';
      case 'semifinal-bye':
        return 'Semifinal (Bye)';
      case 'final':
        return 'Final';
      case 'third-place':
        return '3º/4º Lugar';
      default:
        return phase;
    }
  }
}
