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
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { JsonPipe } from '@angular/common';

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
    MatCheckboxModule,
    MatButtonModule,
    MatButtonToggleModule,
    JsonPipe,
  ],
  template: `
    <div class="p-4 max-w-4xl mx-auto">
      <h1 class="text-2xl font-bold mb-4">Sorteio de Duplas ?</h1>

      @if (priorityEntries().length > 0) {
        <div
          class="bg-white flex-col gap-4 p-4 rounded-lg mb-4 border-outline-variant border shadow-sm"
        >
          <p class="font-medium mb-2">Prioridades para este sorteio</p>
          <div class="flex flex-col gap-1">
            @for (entry of priorityEntries(); track entry.playerId + entry.reason) {
              @if (entry.reason === 'coin-flip-loss') {
                <div class="flex items-center gap-2">
                  <mat-icon
                    class="text-primary! bg-primary-container/10!  size-8! inline-flex! items-center! justify-center! rounded-lg! text-[20px]!"
                    >handshake</mat-icon
                  >
                  <span class="text-xs font-bold"
                    >Perdeu par ou ímpar do encaixe - {{ getPlayerName(entry.playerId) }}</span
                  >
                </div>
              }

              @if (entry.reason === 'direct-elimination') {
                <div class="flex items-center gap-2">
                  <mat-icon
                    class="text-error! bg-error-container/30!  size-8! inline-flex! items-center! justify-center! rounded-lg! text-[20px]!"
                    >group_off</mat-icon
                  >
                  <span class="text-xs font-bold"
                    >Eliminação direta - {{ getPlayerName(entry.playerId) }}</span
                  >
                </div>
              }
            }
          </div>
        </div>
      }

      @if (loading()) {
        <p class="text-gray-500">Gerando propostas...</p>
      }

      @if (!loading() && proposals().length > 0) {
        <div class="flex items-center justify-center mb-4">
          <mat-button-toggle-group class="w-full!" aria-label="Favorite Color">
            @for (proposal of proposals(); track proposal.id; let i = $index) {
              <mat-button-toggle
                class="w-full!"
                (click)="selectProposal(i)"
                [value]="i + 1"
                [checked]="selectedIndex() === i"
                >Proposta {{ i + 1 }}</mat-button-toggle
              >
            }
          </mat-button-toggle-group>
        </div>

        @if (currentProposal()) {
          @if (currentProposal()!.waitingPlayerId) {
            <div
              class="flex items-center gap-2 bg-secondary-container/30! rounded-sm p-2 mb-4 border-l-4 border-secondary-container!"
            >
              <mat-icon
                class="text-secondary! font-bold size-8! inline-flex! items-center! justify-center! rounded-lg!"
                >hourglass_empty</mat-icon
              >
              <span class="text-lg font-bold text-secondary"
                >Jogador em espera - {{ getPlayerName(currentProposal()!.waitingPlayerId!) }}</span
              >
            </div>
          }

          <div class="mb-4">
            @if (repeatedPairWarning()) {
              <div
                class="flex items-start gap-2 bg-error-container/90! rounded-lg p-3 border-l-4 border-error mb-3"
              >
                <mat-icon
                  class="text-red-500! bg-error-container/90! size-8! inline-flex! items-center! justify-center! rounded-lg! text-[20px]!"
                  >warning</mat-icon
                >
                <div>
                  <p class="font-medium text-red-700">Dupla(s) repetida(s) nesta sessão</p>
                  <p class="text-sm text-red-700 bold">{{ repeatedPairWarning() }}</p>
                </div>
              </div>
            }

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              @for (team of currentProposal()!.teams; track team.id; let ti = $index) {
                <mat-card class="border! border-outline-variant! bg-white! shadow-none!">
                  <mat-card-content class="p-3">
                    <div
                      class="flex items-center justify-between gap-2 mb-2 border-b border-outline-variant pb-2"
                    >
                      <div class="flex items-center gap-2">
                        <mat-icon class="text-primary!">group</mat-icon>
                        <h4 class="text-primary font-medium uppercase">Dupla {{ ti + 1 }}</h4>
                      </div>

                      <div class="flex items-center gap-1">
                        @for (badge of getBadgesForTeam(team.id); track badge.type) {
                          @if (badge.type === 'same-gender') {
                            @let player1 = players().find((p) => p.id === team.playerIds[0]);
                            @let player2 = players().find((p) => p.id === team.playerIds[1]);
                            @let bothMen = player1?.gender === 'M' && player2?.gender === 'M';
                            @let bothWomen = player1?.gender === 'F' && player2?.gender === 'F';
                            @if (bothMen || bothWomen) {
                              <mat-icon
                                class=" bg-primary-container/30!  size-8! inline-flex! items-center! justify-center! rounded-lg! text-[20px]!"
                                [class.text-primary!]="bothMen"
                                [class.text-pink-700!]="bothWomen"
                                [class.bg-primary-container/30!]="bothMen"
                                [class.bg-pink-700/30!]="bothWomen"
                                >{{ bothMen ? 'man' : bothWomen ? 'woman' : 'person' }}</mat-icon
                              >
                              <mat-icon
                                class="size-8! inline-flex! items-center! justify-center! rounded-lg! text-[20px]!"
                                [class.text-primary!]="bothMen"
                                [class.text-pink-700!]="bothWomen"
                                [class.bg-primary-container/30!]="bothMen"
                                [class.bg-pink-700/30!]="bothWomen"
                                >{{ bothMen ? 'man' : bothWomen ? 'woman' : 'person' }}</mat-icon
                              >
                            }
                          }
                          @if (badge.type === 'repeated-pair') {
                            <mat-icon
                              class="text-error! bg-error-container/30!  size-8! inline-flex! items-center! justify-center! rounded-lg! text-[20px]!"
                              >replay</mat-icon
                            >
                          }
                          @if (badge.type === 'priority-player') {}
                        }
                      </div>
                    </div>
                    <div class="flex items-center justify-between gap-2">
                      @for (pid of team.playerIds; track pid; let pi = $index) {
                        <mat-form-field appearance="outline" class="w-full! text-sm">
                          <mat-select
                            [value]="pid"
                            (selectionChange)="swapPlayer(team.id, pi, $event.value)"
                          >
                            @for (player of availablePlayers(); track player.id) {
                              <mat-option [value]="player.id">{{ player.name }}</mat-option>
                            }
                          </mat-select>

                          @let playerOnePriorityEntry =
                            priorityEntries().find((entry) => entry.playerId === team.playerIds[0]);
                          @let playerTwoPriorityEntry =
                            priorityEntries().find((entry) => entry.playerId === team.playerIds[1]);

                          @if (pid === team.playerIds[0] && playerOnePriorityEntry) {
                            <mat-icon
                              matSuffix
                              [class.text-primary!]="
                                playerOnePriorityEntry.reason === 'waiting-draw'
                              "
                              [class.text-error!]="
                                playerOnePriorityEntry.reason === 'direct-elimination'
                              "
                              [class.text-secondary!]="
                                playerOnePriorityEntry.reason === 'coin-flip-loss'
                              "
                              [class.text-warning!]="
                                playerOnePriorityEntry.reason === 'waiting-player-not-used'
                              "
                              >{{ getIconNameForReason(playerOnePriorityEntry.reason) }}</mat-icon
                            >
                          }

                          @if (pid === team.playerIds[1] && playerTwoPriorityEntry) {
                            <mat-icon
                              matSuffix
                              [class.text-primary!]="
                                playerTwoPriorityEntry.reason === 'waiting-draw'
                              "
                              [class.text-error!]="
                                playerTwoPriorityEntry.reason === 'direct-elimination'
                              "
                              [class.text-secondary!]="
                                playerTwoPriorityEntry.reason === 'coin-flip-loss'
                              "
                              [class.text-warning!]="
                                playerTwoPriorityEntry.reason === 'waiting-player-not-used'
                              "
                              >{{ getIconNameForReason(playerTwoPriorityEntry.reason) }}</mat-icon
                            >
                          }
                        </mat-form-field>
                      }
                    </div>
                  </mat-card-content>
                </mat-card>
              }
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <button
              matButton
              class="w-full! bg-on-primary-container! text-primary-container!
                    shadow-lg hover:shadow-xl hover:scale-105
                    transition-all duration-300 active:scale-95
                    rounded-lg!"
              extended
              (click)="generate()"
            >
              <mat-icon class="text-primary-container!">shuffle</mat-icon>
              Sortear novamente
            </button>
            <button
              matButton
              class="w-full! bg-primary-container! text-on-primary-container!
                    shadow-lg hover:shadow-xl hover:scale-105
                    transition-all duration-300 active:scale-95
                    rounded-lg!"
              extended
              (click)="confirmDraw()"
            >
              <mat-icon class="text-on-primary-container!">check</mat-icon>
              Criar campeonato
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
  lastWaitingPlayerName = signal<string | null>(null);
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

    await this.resolveLastWaitingPlayer();
    await this.generate();
  }

  /**
   * Sinaliza o jogador que ficou em espera (avulso) no último campeonato desta
   * sessão, para que o organizador possa priorizá-lo no novo sorteio.
   */
  private async resolveLastWaitingPlayer() {
    const tournaments = await this.facade.getTournamentsBySessionId(this.sessionId);
    const lastWithWaiting = [...tournaments]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .reverse()
      .find((t) => !!t.waitingPlayerId);

    this.lastWaitingPlayerName.set(
      lastWithWaiting?.waitingPlayerId ? this.getPlayerName(lastWithWaiting.waitingPlayerId) : null,
    );
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
        return 'ficou de fora no sorteio anterior';
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

  getIconNameForReason(reason: TournamentPriorityEntry['reason'] | undefined): string {
    switch (reason) {
      case 'waiting-draw':
        return 'handshake';
      case 'direct-elimination':
        return 'group_off';
      case 'coin-flip-loss':
        return 'flip';
      case 'waiting-player-not-used':
        return 'person_off';
      default:
        return 'help';
    }
  }

  async regenerate() {
    await this.generate();
  }
}
