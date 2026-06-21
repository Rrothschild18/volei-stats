import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AppFacade } from '../../../core/facade/app.facade';

interface DashboardData {
  totalMatches: number;
  totalActivePlayers: number;
  topWinsPlayer: string | null;
  topWinPctPlayer: string | null;
  topWinPctValue: number;
  topTeam: string | null;
  topTeamWinPct: number;
  mostWaitedPlayer: string | null;
  mostWaitedCount: number;
  totalDraws: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, MatCardModule, MatIconModule, MatButtonModule],
  template: `
    <div class="p-4 max-w-4xl mx-auto">
      <h1 class="text-2xl font-bold mb-6">Dashboard</h1>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <mat-card>
          <mat-card-content class="p-4 text-center">
            <mat-icon class="text-blue-500 text-4xl mb-2">sports_volleyball</mat-icon>
            <p class="text-3xl font-bold">{{ data()?.totalMatches || 0 }}</p>
            <p class="text-sm text-gray-500">Partidas Realizadas</p>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-content class="p-4 text-center">
            <mat-icon class="text-green-500 text-4xl mb-2">people</mat-icon>
            <p class="text-3xl font-bold">{{ data()?.totalActivePlayers || 0 }}</p>
            <p class="text-sm text-gray-500">Jogadores Ativos</p>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-content class="p-4 text-center">
            <mat-icon class="text-purple-500 text-4xl mb-2">casino</mat-icon>
            <p class="text-3xl font-bold">{{ data()?.totalDraws || 0 }}</p>
            <p class="text-sm text-gray-500">Sorteios Realizados</p>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-content class="p-4 text-center">
            <mat-icon class="text-yellow-500 text-4xl mb-2">emoji_events</mat-icon>
            <p class="text-xl font-bold">{{ data()?.topWinsPlayer || '-' }}</p>
            <p class="text-sm text-gray-500">Mais Vitórias</p>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-content class="p-4 text-center">
            <mat-icon class="text-orange-500 text-4xl mb-2">trending_up</mat-icon>
            <p class="text-xl font-bold">{{ data()?.topWinPctPlayer || '-' }}</p>
            <p class="text-sm text-gray-500">Melhor % ({{ data()?.topWinPctValue || 0 }}%)</p>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-content class="p-4 text-center">
            <mat-icon class="text-teal-500 text-4xl mb-2">group</mat-icon>
            <p class="text-xl font-bold">{{ data()?.topTeam || '-' }}</p>
            <p class="text-sm text-gray-500">Melhor Dupla ({{ data()?.topTeamWinPct || 0 }}%)</p>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-content class="p-4 text-center">
            <mat-icon class="text-red-500 text-4xl mb-2">hourglass_empty</mat-icon>
            <p class="text-xl font-bold">{{ data()?.mostWaitedPlayer || '-' }}</p>
            <p class="text-sm text-gray-500">Mais Esperou ({{ data()?.mostWaitedCount || 0 }}x)</p>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="mt-8 flex flex-wrap gap-3">
        <a mat-raised-button routerLink="/sessoes/nova">
          <mat-icon>add</mat-icon>
          Nova Sessão
        </a>
        <a mat-button routerLink="/jogadores">Jogadores</a>
        <a mat-button routerLink="/historico">Histórico</a>
        <a mat-button routerLink="/rankings">Rankings</a>
        <button mat-button (click)="exportData()">
          <mat-icon>download</mat-icon>
          Exportar JSON
        </button>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private facade = inject(AppFacade);
  data = signal<DashboardData | null>(null);

  async ngOnInit() {
    const dashboard = await this.facade.getDashboardData();
    this.data.set(dashboard);
  }

  async exportData() {
    const json = await this.facade.exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `volei-stats-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
