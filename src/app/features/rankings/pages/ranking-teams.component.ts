import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { AppFacade } from '../../../core/facade/app.facade';

interface TeamRankingEntry {
  position: number;
  names: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winPercentage: number;
}

@Component({
  selector: 'app-ranking-teams',
  imports: [RouterLink, MatTableModule, MatButtonModule],
  template: `
    <div class="p-4 max-w-4xl mx-auto">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-2xl font-bold">Ranking de Duplas</h1>
        <a mat-button routerLink="/rankings">← Ranking Individual</a>
      </div>

      <p class="text-sm text-gray-500 mb-4">Apenas duplas com no mínimo 3 partidas juntas.</p>

      @if (rankings().length === 0) {
        <p class="text-center text-gray-500 mt-8">Nenhuma dupla com 3+ partidas encontrada.</p>
      }

      @if (rankings().length > 0) {
        <div class="overflow-x-auto">
          <table mat-table [dataSource]="rankings()" class="w-full" aria-label="Ranking de duplas">
            <ng-container matColumnDef="position">
              <th mat-header-cell *matHeaderCellDef>#</th>
              <td mat-cell *matCellDef="let r">{{ r.position }}</td>
            </ng-container>

            <ng-container matColumnDef="names">
              <th mat-header-cell *matHeaderCellDef>Dupla</th>
              <td mat-cell *matCellDef="let r">{{ r.names }}</td>
            </ng-container>

            <ng-container matColumnDef="gamesPlayed">
              <th mat-header-cell *matHeaderCellDef>Jogos</th>
              <td mat-cell *matCellDef="let r">{{ r.gamesPlayed }}</td>
            </ng-container>

            <ng-container matColumnDef="wins">
              <th mat-header-cell *matHeaderCellDef>V</th>
              <td mat-cell *matCellDef="let r">{{ r.wins }}</td>
            </ng-container>

            <ng-container matColumnDef="losses">
              <th mat-header-cell *matHeaderCellDef>D</th>
              <td mat-cell *matCellDef="let r">{{ r.losses }}</td>
            </ng-container>

            <ng-container matColumnDef="winPercentage">
              <th mat-header-cell *matHeaderCellDef>%</th>
              <td mat-cell *matCellDef="let r">{{ r.winPercentage }}%</td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>
      }
    </div>
  `,
})
export class RankingTeamsComponent implements OnInit {
  private facade = inject(AppFacade);
  rankings = signal<TeamRankingEntry[]>([]);
  columns = ['position', 'names', 'gamesPlayed', 'wins', 'losses', 'winPercentage'];

  async ngOnInit() {
    const stats = await this.facade.getTeamStats();
    const qualified = stats
      .filter((s) => s.gamesPlayed >= 3)
      .sort((a, b) => b.winPercentage - a.winPercentage);

    this.rankings.set(
      qualified.map((s, i) => ({
        position: i + 1,
        names: s.playerNames.join(' + '),
        gamesPlayed: s.gamesPlayed,
        wins: s.wins,
        losses: s.losses,
        winPercentage: s.winPercentage,
      })),
    );
  }
}
