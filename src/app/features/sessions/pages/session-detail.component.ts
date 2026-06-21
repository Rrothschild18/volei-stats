import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { DatePipe } from '@angular/common';
import { AppFacade } from '../../../core/facade/app.facade';
import { Session, Player, Tournament } from '../../../shared/models';

@Component({
  selector: 'app-session-detail',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatCardModule, MatListModule, MatChipsModule, DatePipe],
  template: `
    <div class="p-4 max-w-4xl mx-auto">
      @if (session()) {
        <div class="flex justify-between items-center mb-4">
          <h1 class="text-2xl font-bold">Sessão {{ session()!.date | date:'dd/MM/yyyy' }}</h1>
        </div>

        <mat-card class="mb-4">
          <mat-card-header>
            <mat-card-title>Jogadores Presentes ({{ sessionPlayers().length }})</mat-card-title>
          </mat-card-header>
          <mat-card-content class="p-4">
            <div class="flex flex-wrap gap-2">
              @for (player of sessionPlayers(); track player.id) {
                <mat-chip>{{ player.name }} ({{ player.gender }})</mat-chip>
              }
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="mb-4">
          <mat-card-header>
            <mat-card-title>Campeonatos</mat-card-title>
          </mat-card-header>
          <mat-card-content class="p-4">
            @if (tournaments().length === 0) {
              <p class="text-gray-500">Nenhum campeonato criado ainda.</p>
            }
            @for (tournament of tournaments(); track tournament.id) {
              <div class="flex justify-between items-center py-2 border-b last:border-b-0">
                <span>{{ tournament.teams.length }} duplas • {{ tournament.pointLimit }} pontos</span>
                <span [class]="tournament.status === 'completed' ? 'text-green-600' : 'text-blue-600'">
                  {{ tournament.status === 'completed' ? 'Finalizado' : 'Em andamento' }}
                </span>
                <a mat-icon-button [routerLink]="['/campeonatos', tournament.id]" aria-label="Ver campeonato">
                  <mat-icon>chevron_right</mat-icon>
                </a>
              </div>
            }
          </mat-card-content>
        </mat-card>

        <div class="flex gap-2">
          <a mat-raised-button [routerLink]="['/sorteios', 'novo']" [queryParams]="{ sessionId: session()!.id }">
            <mat-icon>casino</mat-icon>
            Novo Sorteio
          </a>
          <a mat-button routerLink="/sessoes">
            <mat-icon>arrow_back</mat-icon>
            Voltar
          </a>
        </div>
      }
    </div>
  `,
})
export class SessionDetailComponent implements OnInit {
  private facade = inject(AppFacade);
  private route = inject(ActivatedRoute);

  session = signal<Session | null>(null);
  sessionPlayers = signal<Player[]>([]);
  tournaments = signal<Tournament[]>([]);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const session = await this.facade.getSessionById(id);
      if (session) {
        this.session.set(session);

        const players: Player[] = [];
        for (const pid of session.playerIds) {
          const p = await this.facade.getPlayerById(pid);
          if (p) players.push(p);
        }
        this.sessionPlayers.set(players);

        const tournaments = await this.facade.getTournamentsBySessionId(id);
        this.tournaments.set(tournaments);
      }
    }
  }
}
