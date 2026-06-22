import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
  ],
  template: `
    <div class="p-4 max-w-4xl mx-auto">
      @if (tournament()) {
        <div class="flex justify-between items-center mb-4">
          <h1 class="text-2xl font-bold">Campeonato</h1>
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

        <p class="text-gray-600 mb-4">
          {{ tournament()!.teams.length }} duplas • Limite: {{ tournament()!.pointLimit }} pontos
        </p>

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
        @if (tournament()!.status === 'completed' && tournament()!.finalStandings.length > 0) {
          <h2 class="text-lg font-semibold mb-2">Classificação Final</h2>
          <div class="flex flex-col gap-1">
            @for (standing of tournament()!.finalStandings; track standing.teamId) {
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
                <span class="font-bold text-lg w-8">{{ standing.position }}º</span>
                <span>{{ getTeamNames(standing.teamId) }}</span>
              </div>
            }
          </div>
        }

        <div class="mt-4">
          <a mat-button routerLink="/campeonatos">
            <mat-icon>arrow_back</mat-icon>
            Voltar
          </a>
        </div>
      }
    </div>
  `,
})
export class TournamentDetailComponent implements OnInit {
  readonly #facade = inject(AppFacade);
  readonly #tournamentService = inject(TournamentService);
  readonly #route = inject(ActivatedRoute);

  tournament = signal<Tournament | null>(null);
  completedMatches = signal<Match[]>([]);
  pendingMatches = signal<BracketMatch[]>([]);
  players = signal<Map<string, Player>>(new Map());
  scoreInputs: { scoreA: number; scoreB: number }[] = [];
  matchErrors: string[] = [];
  matchWarnings: string[] = [];

  async ngOnInit() {
    const id = this.#route.snapshot.paramMap.get('id');
    if (id) {
      await this.loadTournament(id);
    }
  }

  async loadTournament(id: string) {
    const tournament = await this.#facade.getTournamentById(id);
    if (!tournament) return;

    // Load players
    const playerMap = new Map<string, Player>();
    for (const team of tournament.teams) {
      for (const pid of team.playerIds) {
        if (!playerMap.has(pid)) {
          const p = await this.#facade.getPlayerById(pid);
          if (p) playerMap.set(pid, p);
        }
      }
    }
    this.players.set(playerMap);

    // Load completed matches
    const matches = await this.#facade.getMatchesByTournamentId(id);
    const syncedTournament = await this.#tournamentService.syncTournamentState(tournament, matches);
    this.tournament.set(syncedTournament);
    this.completedMatches.set(matches.filter((m) => m.winnerId !== null));

    // Generate pending matches
    if (syncedTournament.status !== 'completed') {
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
  }

  getTeamNames(teamId: string): string {
    const tournament = this.tournament();
    if (!tournament) return '';
    const team = tournament.teams.find((t) => t.id === teamId);
    if (!team) return '';
    const names = team.playerIds.map((pid) => this.players().get(pid)?.name || '?');
    return names.join(' + ');
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
    await this.#tournamentService.syncTournamentState(tournament, allMatches);
    if (this.#tournamentService.isTournamentComplete(tournament, allMatches)) {
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
