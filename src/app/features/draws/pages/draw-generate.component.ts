import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { AppFacade } from '../../../core/facade/app.facade';
import { DrawService } from '../../../core/services/draw.service';
import { Player, DrawProposal, TournamentPriorityEntry } from '../../../shared/models';

@Component({
  selector: 'app-draw-generate',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatBadgeModule,
    MatSelectModule,
    MatFormFieldModule,
  ],
  template: `
    <div class="p-4 max-w-4xl mx-auto">
      <h1 class="text-2xl font-bold mb-4">Sorteio de Duplas</h1>

      @if (priorityEntries().length > 0) {
        <mat-card class="mb-4 border-l-4 border-blue-400">
          <mat-card-content class="p-4">
            <p class="font-medium mb-2">Prioridades para este sorteio</p>
            <div class="flex flex-col gap-1">
              @for (entry of priorityEntries(); track entry.playerId + entry.reason) {
                <p class="text-sm text-gray-700">
                  {{ getPlayerName(entry.playerId) }}: {{ getPriorityReasonLabel(entry.reason) }}
                </p>
              }
            </div>
          </mat-card-content>
        </mat-card>
      }

      @if (loading()) {
        <p class="text-gray-500">Gerando propostas...</p>
      }

      @if (!loading() && proposals().length > 0) {
        <div class="flex gap-2 mb-4">
          @for (proposal of proposals(); track proposal.id; let i = $index) {
            <button
              mat-raised-button
              [class]="selectedIndex() === i ? 'bg-blue-100' : ''"
              (click)="selectProposal(i)"
            >
              Proposta {{ i + 1 }}
              @if (i === 0) {
                (Melhor)
              }
            </button>
          }
        </div>

        @if (currentProposal()) {
          <div class="mb-4">
            @if (repeatedPairWarning()) {
              <mat-card class="mb-4 border-l-4 border-red-400">
                <mat-card-content class="p-3">
                  <div class="flex items-start gap-2">
                    <mat-icon class="text-red-500">warning</mat-icon>
                    <div>
                      <p class="font-medium text-red-700">Dupla(s) repetida(s) nesta sessão</p>
                      <p class="text-sm text-red-700">{{ repeatedPairWarning() }}</p>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>
            }

            @if (currentProposal()!.waitingPlayerId) {
              <mat-card class="mb-4 border-l-4 border-orange-400">
                <mat-card-content class="p-3">
                  <div class="flex items-center gap-2">
                    <mat-icon class="text-orange-500">hourglass_empty</mat-icon>
                    <span class="font-medium">Jogador em Espera:</span>
                    <span>{{ getPlayerName(currentProposal()!.waitingPlayerId!) }}</span>
                  </div>
                </mat-card-content>
              </mat-card>
            }

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              @for (team of currentProposal()!.teams; track team.id; let ti = $index) {
                <mat-card>
                  <mat-card-content class="p-3">
                    <p class="font-medium mb-2">Dupla {{ ti + 1 }}</p>
                    <div class="flex flex-col gap-1">
                      @for (pid of team.playerIds; track pid; let pi = $index) {
                        <div class="flex items-center gap-2">
                          <mat-form-field appearance="outline" class="flex-1 text-sm">
                            <mat-select
                              [value]="pid"
                              (selectionChange)="swapPlayer(team.id, pi, $event.value)"
                            >
                              @for (player of availablePlayers(); track player.id) {
                                <mat-option [value]="player.id"
                                  >{{ player.name }} ({{ player.gender }})</mat-option
                                >
                              }
                            </mat-select>
                          </mat-form-field>
                        </div>
                      }
                    </div>
                    @for (badge of getBadgesForTeam(team.id); track badge.type) {
                      <mat-chip
                        class="mt-2 text-xs"
                        [class]="
                          badge.type === 'repeated-pair'
                            ? 'bg-red-100 text-red-700'
                            : badge.type === 'same-gender'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-blue-100 text-blue-700'
                        "
                      >
                        {{ badge.description }}
                      </mat-chip>
                    }
                  </mat-card-content>
                </mat-card>
              }
            </div>
          </div>

          <div class="flex gap-2 mt-4 mb-20">
            <button mat-raised-button (click)="confirmDraw()">
              <mat-icon>check</mat-icon>
              Confirmar e Criar Campeonato
            </button>
            <button mat-button (click)="regenerate()">
              <mat-icon>refresh</mat-icon>
              Gerar Novamente
            </button>
          </div>
        }
      }
    </div>
  `,
})
export class DrawGenerateComponent implements OnInit {
  private facade = inject(AppFacade);
  private drawService = inject(DrawService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  proposals = signal<DrawProposal[]>([]);
  selectedIndex = signal(0);
  loading = signal(true);
  players = signal<Player[]>([]);
  availablePlayers = signal<Player[]>([]);
  priorityEntries = signal<TournamentPriorityEntry[]>([]);
  existingPairs = signal<Set<string>>(new Set());
  repeatedPairWarning = signal<string>('');
  private sessionId = '';

  currentProposal = signal<DrawProposal | null>(null);

  async ngOnInit() {
    this.sessionId = this.route.snapshot.queryParamMap.get('sessionId') || '';
    if (!this.sessionId) {
      this.router.navigate(['/sessoes']);
      return;
    }

    const session = await this.facade.getSessionById(this.sessionId);
    if (!session) {
      this.router.navigate(['/sessoes']);
      return;
    }

    const players: Player[] = [];
    for (const pid of session.playerIds) {
      const p = await this.facade.getPlayerById(pid);
      if (p) players.push(p);
    }
    this.players.set(players);
    this.availablePlayers.set(players);

    await this.generate();
  }

  async generate() {
    this.loading.set(true);
    this.repeatedPairWarning.set('');
    const existingPairs = await this.drawService.getExistingPairsInSession(this.sessionId);
    this.existingPairs.set(existingPairs);
    const priorityEntries = await this.drawService.getPriorityEntries(this.sessionId);
    this.priorityEntries.set(priorityEntries);

    const proposals = await this.drawService.generateProposals(
      this.sessionId,
      this.players(),
      existingPairs,
      priorityEntries,
    );

    this.proposals.set(proposals);
    this.selectedIndex.set(0);
    this.currentProposal.set(proposals[0] || null);
    this.refreshRepeatedPairState();
    this.loading.set(false);
  }

  selectProposal(index: number) {
    this.selectedIndex.set(index);
    this.currentProposal.set(this.proposals()[index]);
    this.refreshRepeatedPairState();
  }

  private getPairKey(id1: string, id2: string): string {
    return [id1, id2].sort().join('|');
  }

  /**
   * Recalcula o aviso de duplas repetidas e os selos de "Dupla repetida" da
   * proposta atual, considerando as duplas já jogadas na mesma sessão.
   */
  private refreshRepeatedPairState() {
    const proposal = this.currentProposal();
    if (!proposal) {
      this.repeatedPairWarning.set('');
      return;
    }

    const existing = this.existingPairs();
    const repeatedTeamIds: string[] = [];
    const repeatedNames: string[] = [];

    for (const team of proposal.teams) {
      if (existing.has(this.getPairKey(team.playerIds[0], team.playerIds[1]))) {
        repeatedTeamIds.push(team.id);
        repeatedNames.push(team.playerIds.map((pid) => this.getPlayerName(pid)).join(' + '));
      }
    }

    // Atualiza os selos de dupla repetida sem perder os demais (gênero/prioridade).
    const badges = proposal.badges.filter((b) => b.type !== 'repeated-pair');
    for (const teamId of repeatedTeamIds) {
      badges.push({ teamId, type: 'repeated-pair', description: 'Dupla repetida' });
    }

    const updated = { ...proposal, badges };
    this.currentProposal.set(updated);
    const proposals = [...this.proposals()];
    proposals[this.selectedIndex()] = updated;
    this.proposals.set(proposals);

    this.repeatedPairWarning.set(
      repeatedNames.length > 0
        ? `Estas duplas já jogaram juntas nesta sessão: ${repeatedNames.join('; ')}.`
        : '',
    );
  }

  getPlayerName(id: string): string {
    return this.players().find((p) => p.id === id)?.name || 'Desconhecido';
  }

  getBadgesForTeam(teamId: string) {
    return this.currentProposal()?.badges.filter((b) => b.teamId === teamId) || [];
  }

  getPriorityReasonLabel(reason: TournamentPriorityEntry['reason']): string {
    switch (reason) {
      case 'waiting-draw':
        return 'ficou em espera no sorteio anterior';
      case 'direct-elimination':
        return 'eliminação por maior diferença no campeonato passado';
      case 'coin-flip-loss':
        return 'perdeu o par ou ímpar do encaixe';
      case 'waiting-player-not-used':
        return 'foi avulso e não entrou no campeonato passado';
      default:
        return 'prioridade herdada do campeonato anterior';
    }
  }

  swapPlayer(teamId: string, playerIndex: number, newPlayerId: string) {
    const proposal = this.currentProposal();
    if (!proposal) return;

    const teams = [...proposal.teams];
    const teamIdx = teams.findIndex((t) => t.id === teamId);
    if (teamIdx === -1) return;

    const oldPlayerId = teams[teamIdx].playerIds[playerIndex];
    if (oldPlayerId === newPlayerId) return;

    // Find where the new player currently is
    for (let i = 0; i < teams.length; i++) {
      const pIdx = teams[i].playerIds.indexOf(newPlayerId);
      if (pIdx !== -1) {
        teams[i] = {
          ...teams[i],
          playerIds: [...teams[i].playerIds] as [string, string],
        };
        teams[i].playerIds[pIdx] = oldPlayerId;
        break;
      }
    }

    teams[teamIdx] = {
      ...teams[teamIdx],
      playerIds: [...teams[teamIdx].playerIds] as [string, string],
    };
    teams[teamIdx].playerIds[playerIndex] = newPlayerId;

    const updated = { ...proposal, teams };
    this.currentProposal.set(updated);

    const proposals = [...this.proposals()];
    proposals[this.selectedIndex()] = updated;
    this.proposals.set(proposals);

    // Reavalia duplas repetidas após a troca e avisa o usuário.
    this.refreshRepeatedPairState();
  }

  async confirmDraw() {
    const proposal = this.currentProposal();
    if (!proposal) return;

    // Save all proposals
    for (let i = 0; i < this.proposals().length; i++) {
      const p = { ...this.proposals()[i], selected: i === this.selectedIndex() };
      await this.facade.saveDraw(p);
    }

    // Update session
    const session = await this.facade.getSessionById(this.sessionId);
    if (session) {
      session.drawIds.push(...this.proposals().map((p) => p.id));
      await this.facade.updateSession(session);
    }

    // Navigate to tournament creation
    this.router.navigate(['/campeonatos', 'novo'], {
      queryParams: { drawId: proposal.id, sessionId: this.sessionId },
    });
  }

  async regenerate() {
    await this.generate();
  }
}
