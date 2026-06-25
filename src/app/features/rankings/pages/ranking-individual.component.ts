import { Component, inject, signal, viewChild, effect, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { AppFacade } from '../../../core/facade/app.facade';

interface RankingEntry {
  position: number;
  name: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winPercentage: number;
  timesWaited: number;
}

@Component({
  selector: 'app-ranking-individual',
  imports: [RouterLink, MatTableModule, MatSortModule, MatButtonModule, MatTabsModule],
  template: `
    <div class="p-4 max-w-4xl mx-auto">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-2xl font-bold">Ranking Individual</h1>
        <a mat-button routerLink="duplas">Ver Ranking de Duplas →</a>
      </div>

      @if (rankings().length === 0) {
        <p class="text-center text-gray-500 mt-8">Nenhum jogador com partidas registradas.</p>
      }

      @if (rankings().length > 0) {
        <div class="overflow-x-auto">
          <table
            mat-table
            matSort
            [dataSource]="dataSource"
            class="w-full"
            aria-label="Ranking individual de jogadores"
          >
            <ng-container matColumnDef="position">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>#</th>
              <td mat-cell *matCellDef="let r">{{ r.position }}</td>
            </ng-container>

            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Jogador</th>
              <td mat-cell *matCellDef="let r">{{ r.name }}</td>
            </ng-container>

            <ng-container matColumnDef="gamesPlayed">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Jogos</th>
              <td mat-cell *matCellDef="let r">{{ r.gamesPlayed }}</td>
            </ng-container>

            <ng-container matColumnDef="wins">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>V</th>
              <td mat-cell *matCellDef="let r">{{ r.wins }}</td>
            </ng-container>

            <ng-container matColumnDef="losses">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>D</th>
              <td mat-cell *matCellDef="let r">{{ r.losses }}</td>
            </ng-container>

            <ng-container matColumnDef="winPercentage">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>%</th>
              <td mat-cell *matCellDef="let r">{{ r.winPercentage }}%</td>
            </ng-container>

            <ng-container matColumnDef="timesWaited">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Esperas</th>
              <td mat-cell *matCellDef="let r">{{ r.timesWaited }}</td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>
      }
    </div>
  `,
})
export class RankingIndividualComponent implements OnInit {
  private facade = inject(AppFacade);
  rankings = signal<RankingEntry[]>([]);
  dataSource = new MatTableDataSource<RankingEntry>([]);
  readonly sort = viewChild(MatSort);
  columns = ['position', 'name', 'gamesPlayed', 'wins', 'losses', 'winPercentage', 'timesWaited'];

  constructor() {
    effect(() => {
      const sort = this.sort();
      if (sort) this.dataSource.sort = sort;
    });
  }

  async ngOnInit() {
    const [stats, players] = await Promise.all([
      this.facade.getAllPlayerStats(),
      this.facade.getPlayers(),
    ]);

    const playerMap = new Map(players.map((p) => [p.id, p]));
    const sorted = stats.sort((a, b) => b.winPercentage - a.winPercentage);

    const entries = sorted.map((s, i) => ({
      position: i + 1,
      name: playerMap.get(s.playerId)?.name || 'Desconhecido',
      gamesPlayed: s.gamesPlayed,
      wins: s.wins,
      losses: s.losses,
      winPercentage: s.winPercentage,
      timesWaited: s.timesWaited,
    }));

    this.rankings.set(entries);
    this.dataSource.data = entries;
  }
}
