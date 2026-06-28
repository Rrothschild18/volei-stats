import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { DatePipe } from '@angular/common';
import { AppFacade } from '../../../core/facade/app.facade';
import { Session, Player, Tournament } from '../../../shared/models';

interface TournamentVm {
  tournament: Tournament;
  championTeamId: string | null;
  championNames: string | null;
  secondPlaceNames: string | null;
  waitingPlayerId: string | null;
}

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
  ],
  template: `
    <div class="p-4 max-w-4xl mx-auto">
      <section class="space-y-2 mb-4">
        <h2 class="text-3xl font-bold text-on-surface">
          Sessão {{ session()?.date | date: 'dd/MM/yyyy' }}
        </h2>

        <section class="mb-6">
          <div class="flex items-center gap-2 mb-3">
            <h3 class="text-label-lg font-bold flex items-center gap-2 text-on-surface">
              <span class="material-symbols-outlined text-primary text-[20px]">groups</span>
              Jogadores Presentes
            </h3>
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full"
              >{{ sessionPlayers().length }}</span
            >
          </div>
          <!-- Horizontal scroll of compact chips -->
          <div class="flex gap-2 overflow-x-auto pb-2 hide-scrollbar overflow-auto scrollbar-none">
            @for (player of sessionPlayers(); track player.id) {
              @if (player.gender === 'M') {
                <div
                  class="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full border border-outline-variant/30 shrink-0"
                >
                  <span class="material-symbols-outlined text-[16px] text-blue-700 fill-icon"
                    >male</span
                  >
                  <span class="text-label-md font-medium">{{ player.name }}</span>
                </div>
              } @else {
                <div
                  class="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full border border-outline-variant/30 shrink-0"
                >
                  <span class="material-symbols-outlined text-[16px] text-pink-700 fill-icon"
                    >female</span
                  >
                  <span class="text-label-md font-medium">{{ player.name }}</span>
                </div>
              }
            }
          </div>
        </section>
      </section>
      @if (session()) {
        <div class="flex items-center gap-2 mb-4">
          <mat-icon
            fontSet="material-symbols-outlined"
            class="text-primary!  text-4xl size-10! inline-flex! items-center! justify-center! rounded-xl! "
            >emoji_events</mat-icon
          >
          <h3 class="text-xl font-semibold text-on-surface">Campeonatos do dia</h3>
        </div>

        @for (vm of tournaments(); track vm.tournament.id) {
          <mat-card class="border! border-primary/30! bg-white! border-xl! shadow-none! mb-4">
            <mat-card-content>
              <div class="flex justify-between items-center">
                <div class="flex items-center gap-2 ">
                  <mat-icon
                    class="text-on-primary! bg-primary-container! text-4xl  size-10! inline-flex! items-center! justify-center! rounded-xl! m-icon"
                    >sports_volleyball</mat-icon
                  >
                  <div class="flex gap-2">
                    <p class="text-lg font-semibold text-on-surface">
                      Torneio {{ vm.tournament.name || 'Torneio ' }} ({{ $index + 1 }})
                    </p>
                  </div>
                </div>

                <div class="flex justify-between items-center ">
                  <div class="flex flex-col gap-1">
                    @if (vm.tournament.status === 'completed') {
                      <div>
                        <div class="flex items-center gap-1">
                          <mat-icon
                            fontSet="material-symbols-outlined"
                            class="text-green-600! text-sm! size-4!  leading-4.5!"
                            >check</mat-icon
                          >
                        </div>
                      </div>
                    } @else {
                      <div class="relative flex h-3 w-3">
                        <span
                          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"
                        ></span>
                        <span class="relative inline-flex h-3 w-3 rounded-full bg-blue-500"></span>
                      </div>
                    }

                    <div class="flex items-center gap-1">
                      <mat-icon
                        fontSet="material-symbols-outlined"
                        class="text-primary! text-sm! size-4!  leading-4.5!"
                        >sports_score</mat-icon
                      >
                      <span class="text-sm"> {{ vm.tournament.pointLimit }} </span>
                    </div>
                    <div class="flex items-center gap-1">
                      <mat-icon
                        fontSet="material-symbols-outlined"
                        class="text-primary! text-sm! size-4! leading-4.5!"
                        >group_outlined</mat-icon
                      >
                      <span class="text-sm">{{ vm.tournament.teams.length }} </span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex flex-col gap-1 ">
                <div class="flex items-center gap-2 py-4 border-b border-gray-300 ">
                  @if (vm.championNames) {
                    <div
                      class="w-full bg-secondary-container/10 rounded-xl p-3 flex items-center gap-3 border border-secondary-container/20"
                    >
                      <div
                        class="w-10 h-10 bg-secondary-container/75 text-on-secondary-container rounded-full flex items-center justify-center shrink-0"
                      >
                        <span class="material-symbols-outlined fill-icon text-2xl"
                          >emoji_events</span
                        >
                      </div>
                      <div class="flex flex-col">
                        <span
                          class="text-[10px] font-bold text-on-secondary-container uppercase tracking-wider"
                          >Campeão</span
                        >
                        <span class="text-label-md font-semibold text-on-surface">{{
                          vm.championNames
                        }}</span>
                      </div>
                    </div>
                  }

                  @if (vm.secondPlaceNames) {
                    <div
                      class="w-full bg-surface-container-highest/50 rounded-xl p-3 flex items-center gap-3 border border-outline-variant/20"
                    >
                      <div
                        class="w-10 h-10 bg-outline/25 text-on-surface-variant rounded-full flex items-center justify-center shrink-0"
                      >
                        <span class="material-symbols-outlined text-2xl">military_tech</span>
                      </div>
                      <div class="flex flex-col">
                        <span
                          class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider"
                          >Vice</span
                        >
                        <span class="text-label-md font-medium text-on-surface-variant">{{
                          vm.secondPlaceNames
                        }}</span>
                      </div>
                    </div>
                  }
                </div>

                <a
                  class="flex items-center justify-end pt-2"
                  [routerLink]="['/campeonatos', vm.tournament.id]"
                >
                  <div class="flex items-center gap-1">
                    <span class="text-primary">Ver detalhes</span>
                    <mat-icon class="text-primary!">chevron_right</mat-icon>
                  </div>
                </a>
              </div>
            </mat-card-content>
          </mat-card>
        } @empty {
          <mat-card class="border! border-primary/30! bg-white! border-xl! shadow-none! mb-4">
            <mat-card-content>
              <p class="text-gray-500">Nenhum campeonato criado ainda.</p>
            </mat-card-content>
          </mat-card>
        }

        <div class="flex gap-2 flex-col mb-12">
          <button
            routerLink="/sessoes"
            matButton
            class="w-full! bg-on-primary-container! text-primary-container!
                    shadow-lg hover:shadow-xl hover:scale-105
                    transition-all duration-300 active:scale-95
                    rounded-lg!"
            extended
          >
            <mat-icon class="text-primary-container!">arrow_back</mat-icon>
            voltar
          </button>
          <button
            matButton
            class="w-full! bg-primary-container! text-on-primary-container!
                    shadow-lg hover:shadow-xl hover:scale-105
                    transition-all duration-300 active:scale-95
                    rounded-lg!"
            extended
            [routerLink]="['/sorteios', 'novo']"
            [queryParams]="{ sessionId: session()!.id }"
          >
            <mat-icon class="text-on-primary-container!">casino</mat-icon>
            Novo sorteio
          </button>
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
  tournaments = signal<TournamentVm[]>([]);

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
        const nameMap = new Map(players.map((p) => [p.id, p.name]));

        const tournaments = await this.facade.getTournamentsBySessionId(id);
        this.tournaments.set(tournaments.map((tournament) => this.toVm(tournament, nameMap)));
      }
    }
  }

  private toVm(tournament: Tournament, nameMap: Map<string, string>): TournamentVm {
    let championTeamId: string | null = null;
    let championNames: string | null = null;
    let secondPlaceNames: string | null = null;

    if (tournament.status === 'completed') {
      championTeamId = tournament.finalStandings.find((s) => s.position === 1)?.teamId ?? null;
      const championTeam = tournament.teams.find((t) => t.id === championTeamId);
      if (championTeam) {
        championNames = championTeam.playerIds
          .map((pid) => nameMap.get(pid) ?? 'Desconhecido')
          .join(' e ');
      }

      const secondPlaceTeamId =
        tournament.finalStandings.find((s) => s.position === 2)?.teamId ?? null;
      const secondPlaceTeam = tournament.teams.find((t) => t.id === secondPlaceTeamId);
      if (secondPlaceTeam) {
        secondPlaceNames = secondPlaceTeam.playerIds
          .map((pid) => nameMap.get(pid) ?? 'Desconhecido')
          .join(' e ');
      }
    }

    return {
      tournament,
      championTeamId,
      championNames,
      secondPlaceNames,
      waitingPlayerId: tournament.oddPlayerPlacement ? null : tournament.waitingPlayerId,
    };
  }
}
