import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { DatePipe, NgClass } from '@angular/common';
import { AppFacade } from '../../../core/facade/app.facade';
import { Session, Player, Tournament } from '../../../shared/models';

@Component({
  selector: 'app-session-detail',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatListModule,
    MatChipsModule,
    DatePipe,
    NgClass,
  ],
  template: `
    <div class="p-4 max-w-4xl mx-auto">
      <section class="space-y-2 mb-4">
        <h2 class="text-3xl font-bold text-on-surface">
          Sessão {{ session()?.date | date: 'dd/MM/yyyy' }}
        </h2>
      </section>
      @if (session()) {
        <mat-card
          class="border! border-outline-variant! bg-surface-container-low! shadow-none! mb-4"
        >
          <mat-card-header class="flex mb-2 items-center">
            <mat-icon
              class="text-primary! bg-on-primary-container! size-10! inline-flex! items-center! justify-center! rounded-xl! mr-2"
              >group</mat-icon
            >

            <p class="text-lg font-bold text-primary">
              Jogadores presentes
              <span class="text-lg font-bold  text-primary">({{ sessionPlayers().length }})</span>
            </p>
          </mat-card-header>
          <mat-card-content class="inline-flex! gap-2 items-center! p-4 w-full!">
            <div class="w-full inline-flex! gap-2 items-center flex-wrap justify-center">
              @for (player of sessionPlayers(); track player.id) {
                <div
                  class="flex bg-primary/15 rounded-full border border-primary/30 py-1 justify-center items-center mb-2 w-20"
                >
                  <span class="text-primary font-medium text-sm">{{ player.name }}</span>
                </div>
              }
            </div>
          </mat-card-content>
        </mat-card>

        <div class="flex items-center gap-2 mb-4">
          <mat-icon
            class="text-secondary! bg-secondary-container/10! text-4xl size-10! inline-flex! items-center! justify-center! rounded-xl! "
            >emoji_events</mat-icon
          >
          <h3 class="text-xl font-semibold text-on-surface">Campeonatos</h3>
        </div>

        <mat-card class="border! border-secondary/30! bg-white! border-xl! shadow-none! mb-4">
          <mat-card-content>
            @for (tournament of tournaments(); track tournament.id) {
              <div class="flex justify-between items-center">
                <p class="text-lg font-semibold text-on-surface">Torneio 01</p>

                <small
                  class="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"
                >
                  <small class="w-2 h-2 bg-green-500 rounded-full mr-1"></small>

                  Finalizado</small
                >
              </div>
              <div class="flex justify-between items-center py-2">
                <div class="flex">
                  <mat-icon class="mr-1 text-secondary!">group_outlined</mat-icon>
                  <span>{{ tournament.teams.length }} duplas • </span>
                  <mat-icon class="mr-1 text-secondary!">bolt</mat-icon>
                  <span> {{ tournament.pointLimit }} pontos </span>
                </div>
              </div>

              <div class="h-px bg-outline-variant border-0"></div>

              <div
                class="mt-2 flex items-center justify-between"
                [routerLink]="['/campeonatos', tournament.id]"
              >
                <span class="text-secondary">Ver detalhes</span>
                <mat-icon class="text-secondary!">chevron_right</mat-icon>
              </div>
            } @empty {
              <p class="text-gray-500">Nenhum campeonato criado ainda.</p>
            }
          </mat-card-content>
        </mat-card>

        <div class="flex gap-2 flex-col mb-12">
          <a
            mat-flat-button
            class="w-full block"
            [routerLink]="['/sorteios', 'novo']"
            [queryParams]="{ sessionId: session()!.id }"
          >
            <mat-icon>casino</mat-icon>
            Novo Sorteio
          </a>
          <a mat-button routerLink="/sessoes" class="w-full block">
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
