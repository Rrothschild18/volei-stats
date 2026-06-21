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
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
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
