import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { AppFacade } from '../../../core/facade/app.facade';
import { TournamentService, BracketMatch } from '../../../core/services/tournament.service';
import { Tournament, Match, Player } from '../../../shared/models';
import { TeamsDisplayComponent } from '../../../shared/components/display-team/display-team.component';

interface StandingDisplay {
  label: string;
  names: string;
  position: number | null;
  isChampion: boolean;
  borrowedName: string | null;
  note: string | null;
}

@Component({
  selector: 'app-tournament-detail',
  imports: [
    RouterLink,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatInputModule,
    MatFormFieldModule,
    MatChipsModule,
    TeamsDisplayComponent,
  ],
  template: `
    <div class="p-4 max-w-4xl mx-auto">
      @if (tournament()) {
        <div>
          <div class="flex justify-between items-center mb-4 ">
            <h1 class="text-2xl font-bold">Torneio {{ tournament()!.name }}</h1>
            <span
              [class]="
                tournament()!.status === 'completed'
                  ? 'text-green-600 font-medium'
                  : 'text-blue-600 font-medium'
              "
            >
              {{ tournament()!.status === 'completed' ? 'Finalizado' : 'Em andamento' }}
            </span>
          </div>

          <h4 class="text-lg font-bold mb-2">Configurações</h4>
          <section class=" rounded-lg border border-outline-variant/50 bg-white p-4">
            <div class="flex items-center gap-2 mb-4">
              <span
                class="inline-flex items-center gap-1 text-xs font-bold  rounded-full px-2 py-0.5"
              >
                <mat-icon
                  fontSet="material-symbols-outlined"
                  class="text-sm! w-4! h-4! leading-4! text-primary!"
                  >group</mat-icon
                >

                {{ tournament()!.teams.length }} duplas
              </span>

              <span
                class="inline-flex items-center gap-1 text-xs font-bold rounded-full px-2 py-0.5"
              >
                <mat-icon
                  fontSet="material-symbols-outlined"
                  class="text-sm! w-4! h-4! leading-4! text-primary!"
                  >sports_score</mat-icon
                >
                {{ tournament()!.pointLimit }} pontos
              </span>
            </div>

            <div class="flex flex-col gap-2 mb-4">
              <div class="flex items-center gap-2">
                <span
                  matTooltip="Eliminação direta"
                  aria-label="Eliminação direta"
                  class="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 rounded-full px-2 py-0.5"
                >
                  <mat-icon class="text-sm! w-4! h-4! leading-4!">trending_down</mat-icon>
                </span>
                <span class="text-xs text-gray-700">Eliminação direta</span>
              </div>

              <div class="flex items-center gap-2">
                <span
                  matTooltip="Par ou ímpar do encaixe"
                  aria-label="Par ou ímpar do encaixe"
                  class="inline-flex items-center gap-1 text-xs font-bold  rounded-full bg-tertiary px-2 py-0.5"
                >
                  <mat-icon class="text-sm! w-4! h-4! leading-4! text-on-tertiary-container!"
                    >merge</mat-icon
                  >
                </span>
                <span
                  matTooltip="Par ou ímpar do encaixe"
                  aria-label="Par ou ímpar do encaixe"
                  class="inline-flex items-center gap-1 text-xs font-bold  rounded-full bg-tertiary px-2 py-0.5"
                >
                  <mat-icon class="text-sm! w-4! h-4! leading-4! text-on-tertiary-container!"
                    >call_split</mat-icon
                  >
                </span>
                <span class="text-xs text-gray-700">Par ou ímpar do encaixe</span>
              </div>
            </div>
          </section>
        </div>

        <h2 class="text-lg font-semibold mt-6 mb-4">Duplas</h2>
        <app-teams-display
          class="block mb-4"
          [teams]="tournament()!.teams"
          [players]="playerList()"
          [waitingPlayerId]="visibleWaitingPlayerId()"
          [borrowedPlayerId]="tournament()!.oddPlayerPlacement?.survivingPlayerId ?? null"
        />
        <!-- Completed matches -->
        @if (completedMatches().length > 0) {
          <h2 class="text-lg font-semibold mb-2">Partidas Realizadas</h2>
          <div class="flex flex-col gap-2 mb-4">
            @for (match of completedMatches(); track match.id) {
              <mat-card>
                <mat-card-content class="p-3">
                  <div class="flex justify-between items-center">
                    <div>
                      <span class="text-xs text-gray-500 uppercase">{{
                        getPhaseLabel(match.phase)
                      }}</span>
                      <p class="font-medium">
                        {{ getTeamNames(match.teamAId) }}
                        <span class="mx-2 font-bold">{{ match.scoreA }} x {{ match.scoreB }}</span>
                        {{ getTeamNames(match.teamBId) }}
                      </p>
                    </div>
                    <mat-chip class="text-xs bg-green-100 text-green-700">
                      {{ getTeamNames(match.winnerId!) }} venceu
                    </mat-chip>
                  </div>
                </mat-card-content>
              </mat-card>
            }
          </div>
        }

        <!-- Pending matches -->
        @if (pendingMatches().length > 0 && tournament()!.status !== 'completed') {
          <h2 class="text-lg font-semibold mb-2">Próximas Partidas</h2>
          <div class="flex flex-col gap-3 mb-4">
            @for (match of pendingMatches(); track $index) {
              <mat-card class="border-l-4 border-blue-400">
                <mat-card-content class="p-4">
                  <span class="text-xs text-gray-500 uppercase block mb-2">{{
                    getPhaseLabel(match.phase)
                  }}</span>
                  <p class="font-medium mb-3">
                    {{ getTeamNames(match.teamAId) }} vs {{ getTeamNames(match.teamBId) }}
                  </p>

                  <div class="flex items-center gap-3">
                    <mat-form-field appearance="outline" class="w-20">
                      <mat-label>Placar A</mat-label>
                      <input
                        matInput
                        type="number"
                        min="0"
                        [(ngModel)]="scoreInputs[$index].scoreA"
                      />
                    </mat-form-field>
                    <span class="font-bold">x</span>
                    <mat-form-field appearance="outline" class="w-20">
                      <mat-label>Placar B</mat-label>
                      <input
                        matInput
                        type="number"
                        min="0"
                        [(ngModel)]="scoreInputs[$index].scoreB"
                      />
                    </mat-form-field>
                    <button mat-raised-button (click)="saveMatch($index, match)">Salvar</button>
                  </div>
                  @if (matchErrors[$index]) {
                    <p class="text-red-500 text-sm mt-1">{{ matchErrors[$index] }}</p>
                  }
                  @if (matchWarnings[$index]) {
                    <p class="text-orange-500 text-sm mt-1">{{ matchWarnings[$index] }}</p>
                  }
                </mat-card-content>
              </mat-card>
            }
          </div>
        }

        <!-- Final standings -->
        @if (tournament()!.status === 'completed' && standings().length > 0) {
          <h2 class="text-lg font-semibold mb-2">Classificação Final</h2>
          <div class="flex flex-col gap-1 mb-4">
            @for (standing of standings(); track $index) {
              <div
                class="flex items-center gap-2 p-2 rounded"
                [class]="
                  standing.position === 1
                    ? 'bg-yellow-50'
                    : standing.position === 2
                      ? 'bg-gray-50'
                      : ''
                "
              >
                <span class="font-bold text-lg w-8">{{
                  standing.position ? standing.position + 'º' : '—'
                }}</span>
                <div class="flex flex-col">
                  <span>
                    {{ standing.names }}
                    @if (standing.isChampion) {
                      <mat-icon class="text-yellow-500! align-middle text-base!"
                        >emoji_events</mat-icon
                      >
                    }
                  </span>
                  @if (standing.borrowedName) {
                    <span class="text-xs text-blue-700">
                      {{ standing.borrowedName }} entrou pelo encaixe (venceu o par-ou-ímpar)
                    </span>
                  }
                  @if (standing.note) {
                    <span class="text-xs text-gray-500">{{ standing.note }}</span>
                  }
                </div>
              </div>
            }
          </div>
        }

        <div class="mt-4 flex gap-2">
          <a mat-button routerLink="/campeonatos">
            <mat-icon>arrow_back</mat-icon>
            Voltar
          </a>
          <button mat-button class="text-red-600!" (click)="confirmCancel()">
            <mat-icon>delete</mat-icon>
            Cancelar campeonato
          </button>
        </div>
      }
    </div>

    <!-- Modal: par-ou-ímpar do encaixe -->
    @if (placementCandidate()) {
      <div
        class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="parImparTitle"
      >
        <mat-card class="max-w-md w-full">
          <mat-card-content class="p-4">
            <h2 id="parImparTitle" class="text-xl font-bold mb-2">Encaixe — Par ou ímpar</h2>
            <p class="text-sm text-gray-700 mb-4">
              A dupla que perdeu por menor diferença disputa o par-ou-ímpar. Selecione quem
              <strong>venceu</strong>: o vencedor forma dupla com o avulso ({{
                getPlayerName(tournament()!.waitingPlayerId!)
              }}) e o perdedor é eliminado.
            </p>
            <div class="flex flex-col gap-2">
              @for (pid of placementCandidate()!.playerIds; track pid) {
                <button mat-raised-button (click)="resolvePlacement(pid)">
                  {{ getPlayerName(pid) }} venceu
                </button>
              }
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    }
  `,
})
export class TournamentDetailComponent implements OnInit {
  readonly #facade = inject(AppFacade);
  readonly #tournamentService = inject(TournamentService);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);

  tournament = signal<Tournament | null>(null);
  completedMatches = signal<Match[]>([]);
  pendingMatches = signal<BracketMatch[]>([]);
  players = signal<Map<string, Player>>(new Map());
  playerList = signal<Player[]>([]);
  standings = signal<StandingDisplay[]>([]);
  placementCandidate = signal<{ playerIds: [string, string] } | null>(null);
  scoreInputs: { scoreA: number; scoreB: number }[] = [];
  matchErrors: string[] = [];
  matchWarnings: string[] = [];

  async ngOnInit() {
    const id = this.#route.snapshot.paramMap.get('id');
    if (id) {
      await this.loadTournament(id);
    }
  }

  visibleWaitingPlayerId(): string | null {
    const t = this.tournament();
    if (!t) return null;
    return t.oddPlayerPlacement ? null : t.waitingPlayerId;
  }

  async loadTournament(id: string) {
    const tournament = await this.#facade.getTournamentById(id);
    if (!tournament) return;

    const matches = await this.#facade.getMatchesByTournamentId(id);
    const syncedTournament = await this.#tournamentService.syncTournamentState(tournament);

    // Load all relevant players (teams, original pairs, waiting player).
    const ids = new Set<string>();
    for (const team of syncedTournament.teams) {
      team.playerIds.forEach((pid) => ids.add(pid));
      team.originalPlayerIds?.forEach((pid) => ids.add(pid));
    }
    if (syncedTournament.waitingPlayerId) ids.add(syncedTournament.waitingPlayerId);
    const playerMap = new Map<string, Player>();
    for (const pid of ids) {
      const p = await this.#facade.getPlayerById(pid);
      if (p) playerMap.set(pid, p);
    }
    this.players.set(playerMap);
    this.playerList.set([...playerMap.values()]);

    this.tournament.set(syncedTournament);
    this.completedMatches.set(matches.filter((m) => m.winnerId !== null));
    this.pendingMatches.set([]);
    this.placementCandidate.set(null);
    this.standings.set([]);

    if (syncedTournament.status === 'completed') {
      this.buildStandings(syncedTournament);
      return;
    }

    // Aguardando decisão do par-ou-ímpar do encaixe?
    if (this.#tournamentService.needsOddPlayerPlacementDecision(syncedTournament, matches)) {
      const candidate = this.#tournamentService.getOddPlayerPlacementCandidate(
        syncedTournament,
        matches,
      );
      if (candidate) {
        this.placementCandidate.set({ playerIds: candidate.playerIds });
        return;
      }
    }

    // Generate pending matches
    let pending: BracketMatch[];
    const initialMatches = this.#tournamentService.generateInitialMatches(syncedTournament);
    const completedPairs = new Set(
      matches.filter((m) => m.winnerId).map((m) => `${m.teamAId}|${m.teamBId}`),
    );
    const pendingInitial = initialMatches.filter(
      (m) =>
        !completedPairs.has(`${m.teamAId}|${m.teamBId}`) &&
        !completedPairs.has(`${m.teamBId}|${m.teamAId}`),
    );
    if (pendingInitial.length > 0) {
      pending = pendingInitial;
    } else if (matches.filter((m) => m.winnerId).length === 0) {
      pending = initialMatches;
    } else {
      pending = await this.#tournamentService.getNextMatches(syncedTournament);
    }
    this.pendingMatches.set(pending);
    this.scoreInputs = pending.map(() => ({ scoreA: 0, scoreB: 0 }));
    this.matchErrors = pending.map(() => '');
    this.matchWarnings = pending.map(() => '');
  }

  private buildStandings(tournament: Tournament) {
    const champion = tournament.finalStandings.find((s) => s.position === 1)?.teamId ?? null;
    const placement = tournament.oddPlayerPlacement;
    const ordered = [...tournament.finalStandings].sort((a, b) => a.position - b.position);

    const rows: StandingDisplay[] = ordered.map((standing) => {
      const team = tournament.teams.find((t) => t.id === standing.teamId);
      const isSynthetic = !!team && placement?.sourceTeamId === team.id;
      return {
        label: 'Dupla',
        names: this.getTeamNames(standing.teamId),
        position: standing.position,
        isChampion: standing.teamId === champion,
        borrowedName: isSynthetic ? this.getPlayerName(placement!.survivingPlayerId) : null,
        note: null,
      };
    });

    // 5ª dupla: a dupla original desfeita pelo encaixe.
    if (placement) {
      const names = [placement.survivingPlayerId, placement.eliminatedPlayerId]
        .map((pid) => this.getPlayerName(pid))
        .join(' + ');
      rows.push({
        label: 'Dupla original',
        names,
        position: null,
        isChampion: false,
        borrowedName: null,
        note: 'Dupla original desfeita no encaixe',
      });
    }

    this.standings.set(rows);
  }

  getTeamNames(teamId: string): string {
    const tournament = this.tournament();
    if (!tournament) return '';
    const team = tournament.teams.find((t) => t.id === teamId);
    if (!team) return '';
    const names = team.playerIds.map((pid) => this.players().get(pid)?.name || '?');
    return names.join(' + ');
  }

  getPlayerName(id: string): string {
    return this.players().get(id)?.name || '?';
  }

  getPhaseLabel(phase: string): string {
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

  async resolvePlacement(survivingPlayerId: string) {
    const tournament = this.tournament();
    if (!tournament) return;
    const matches = await this.#facade.getMatchesByTournamentId(tournament.id);
    await this.#tournamentService.applyOddPlayerPlacement(tournament, survivingPlayerId, matches);
    await this.loadTournament(tournament.id);
  }

  async confirmCancel() {
    const tournament = this.tournament();
    if (!tournament) return;
    const ok = confirm(
      'Cancelar e excluir este campeonato? Ele não contará para prioridades nem sorteios.',
    );
    if (!ok) return;
    const sessionId = tournament.sessionId;
    await this.#facade.deleteTournament(tournament.id);
    this.#router.navigate(['/sessoes', sessionId]);
  }

  async saveMatch(index: number, bracketMatch: BracketMatch) {
    const { scoreA, scoreB } = this.scoreInputs[index];
    this.matchErrors[index] = '';
    this.matchWarnings[index] = '';

    if (scoreA === scoreB) {
      this.matchErrors[index] = 'Vôlei não tem empate. Os placares devem ser diferentes.';
      return;
    }
    if (scoreA === 0 && scoreB === 0) {
      this.matchErrors[index] = 'Placar não pode ser 0 x 0.';
      return;
    }

    const tournament = this.tournament()!;
    const winnerScore = Math.max(scoreA, scoreB);
    if (winnerScore < tournament.pointLimit) {
      this.matchWarnings[index] =
        `Aviso: O placar do vencedor (${winnerScore}) é menor que o limite configurado (${tournament.pointLimit}).`;
    }

    const winnerId = scoreA > scoreB ? bracketMatch.teamAId : bracketMatch.teamBId;
    const loserId = scoreA > scoreB ? bracketMatch.teamBId : bracketMatch.teamAId;

    const match: Match = {
      id: crypto.randomUUID(),
      tournamentId: tournament.id,
      sessionId: tournament.sessionId,
      phase: bracketMatch.phase,
      teamAId: bracketMatch.teamAId,
      teamBId: bracketMatch.teamBId,
      scoreA,
      scoreB,
      winnerId,
      loserId,
      pointDifference: Math.abs(scoreA - scoreB),
      playedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await this.#facade.saveMatch(match);
    tournament.matches.push(match.id);

    // Check if tournament is complete
    const allMatches = await this.#facade.getMatchesByTournamentId(tournament.id);
    await this.#tournamentService.syncTournamentState(tournament);
    if (await this.#tournamentService.isTournamentComplete(tournament, allMatches)) {
      tournament.status = 'completed';
      tournament.finalStandings = this.#tournamentService.computeFinalStandings(
        tournament,
        allMatches,
      );
    }

    await this.#facade.saveTournament(tournament);
    await this.loadTournament(tournament.id);
  }
}
