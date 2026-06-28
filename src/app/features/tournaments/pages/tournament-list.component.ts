import { Component, inject, signal, OnInit, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { JsonPipe } from '@angular/common';
import { AppFacade } from '../../../core/facade/app.facade';
import { Player, Tournament, TournamentTeam } from '../../../shared/models';

type HydratedTournament = Tournament & {
  firstPlaceTeam?: TournamentTeam & { players: Player[] };
  secondPlaceTeam?: TournamentTeam & { players: Player[] };
};

@Component({
  selector: 'app-tournament-list',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatCardModule, JsonPipe],
  template: `
    <div class="p-4 max-w-4xl mx-auto">
      <h1 class="text-2xl font-bold mb-4">Campeonatos</h1>

      @if (tournaments().length === 0) {
        <p class="text-center text-gray-500 mt-8">Nenhum campeonato registrado.</p>
      }

      @if (hydratedTournamentsResource.isLoading()) {
        <p>Carregando campeonatos...</p>
      } @else {
        @for (t of hydratedTournamentsResource.value(); track t.id) {
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
                      Torneio {{ t.name || 'Torneio ' }} ({{ $index + 1 }})
                    </p>
                    <mat-icon
                      class="text-green-600! rounded-full!text-sm!  size-8! inline-flex! items-center! justify-center! m-icon"
                      >check</mat-icon
                    >
                  </div>
                </div>

                @if (t.status === 'completed') {
                  <div class="flex justify-between items-center ">
                    <div class="flex flex-col gap-1">
                      <div class="flex items-center gap-1">
                        <mat-icon
                          fontSet="material-symbols-outlined"
                          class="text-primary! text-sm! size-4!  leading-4.5!"
                          >star</mat-icon
                        >
                        <span class="text-sm"> {{ t.pointLimit }} pts </span>
                      </div>
                      <div class="flex items-center gap-1">
                        <mat-icon
                          fontSet="material-symbols-outlined"
                          class="text-primary! text-sm! size-4! leading-4.5!  "
                          >group_outlined</mat-icon
                        >
                        <span class="text-sm"
                          >{{ t.teams.length }} dupla{{ t.waitingPlayerId ? ' + 1' : '' }}
                        </span>
                      </div>
                    </div>
                  </div>
                } @else {
                  <small
                    class="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"
                  >
                    <small class="w-2 h-2 bg-blue-500 rounded-full mr-1 uppercase"></small>
                    Em andamento
                  </small>
                }
              </div>

              <div class="flex flex-col gap-1 ">
                <div class="flex items-center gap-2 py-4 border-b border-gray-300 ">
                  @if (t.firstPlaceTeam; as firstPlaceTeam) {
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
                        <span class="text-label-md font-semibold text-on-surface"
                          >{{ firstPlaceTeam.players[0].name }} e
                          {{ firstPlaceTeam.players[1].name }}</span
                        >
                      </div>
                    </div>
                  }

                  @if (t.secondPlaceTeam; as secondPlaceTeam) {
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
                        <span class="text-label-md font-medium text-on-surface-variant"
                          >{{ secondPlaceTeam.players[0].name }} e
                          {{ secondPlaceTeam.players[1].name }}</span
                        >
                      </div>
                    </div>
                  }
                </div>

                <a class="flex items-center justify-end pt-2" [routerLink]="['/campeonatos', t.id]">
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
      }
    </div>
  `,
})
export class TournamentListComponent implements OnInit {
  readonly #appFacade = inject(AppFacade);

  readonly tournaments = signal<Tournament[]>([]);

  readonly hydratedTournamentsResource = resource({
    params: () => this.tournaments(),

    loader: async ({ params: tournaments }): Promise<HydratedTournament[]> => {
      return Promise.all(
        tournaments.map(async (tournament) => {
          const hydrateTeam = async (
            placement: number,
          ): Promise<(TournamentTeam & { players: Player[] }) | undefined> => {
            const standing = tournament.finalStandings[placement];

            if (!standing) {
              return undefined;
            }

            const team = tournament.teams.find((team) => team.id === standing.teamId);

            if (!team) {
              return undefined;
            }

            const players = (
              await Promise.all(team.playerIds.map((id) => this.#appFacade.getPlayerById(id)))
            ).filter((player): player is Player => !!player);

            return {
              ...team,
              players,
            };
          };

          const [firstPlaceTeam, secondPlaceTeam] = await Promise.all([
            hydrateTeam(0),
            hydrateTeam(1),
          ]);

          return {
            ...tournament,
            firstPlaceTeam,
            secondPlaceTeam,
          };
        }),
      );
    },
  });

  readonly loading = this.hydratedTournamentsResource.isLoading;

  readonly error = this.hydratedTournamentsResource.error;

  async ngOnInit() {
    const tournaments = await this.#appFacade.getTournaments();

    this.tournaments.set(tournaments.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }
}
