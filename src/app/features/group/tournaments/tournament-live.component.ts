import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import { LiveTournamentStore } from '../../../core/stores/live-tournament.store';
import { BracketMatch } from '../../../core/services/tournament.service';
import { formatTime } from '../../../shared/utils/date.util';
import {
  BlueprintComponent,
  HeroFieldComponent,
  IconComponent,
  InlineNoteComponent,
  InnerHeaderComponent,
  LadderComponent,
  RoleTagComponent,
  SectionBandComponent,
  SegmentedComponent,
} from '../../../shared/ui';
import { ScoreSheetComponent } from './score-sheet.component';
import { PlacementSheetComponent } from './placement-sheet.component';
import { TiebreakSheetComponent } from './tiebreak-sheet.component';

type Tab = 'queue' | 'bracket' | 'teams';

/**
 * Campeonato ao vivo: a fila (1k), a chave em escada (1l/1m) e as duplas.
 *
 * Quando falta uma decisão de quadra, a chave pausa: o admin vê o sheet para
 * registrar, e o jogador vê que está pausada (1s).
 */
@Component({
  selector: 'app-tournament-live',
  imports: [
    BlueprintComponent,
    HeroFieldComponent,
    IconComponent,
    InlineNoteComponent,
    InnerHeaderComponent,
    LadderComponent,
    PlacementSheetComponent,
    RoleTagComponent,
    SectionBandComponent,
    SegmentedComponent,
    ScoreSheetComponent,
    TiebreakSheetComponent,
  ],
  template: `
    <app-inner-header
      [context]="context()"
      [title]="store.tournament()?.name ?? ''"
      (back)="back()"
    >
      <app-role-tag [role]="group.role()" [playerName]="group.me()?.name ?? null" />
    </app-inner-header>

    <app-segmented [options]="tabs" [value]="tab()" (valueChange)="tab.set($any($event))" />

    @if (store.paused() && !group.isAdmin()) {
      <app-blueprint class="mx-4 mt-4 flex flex-col gap-2 p-4">
        <app-icon name="hand" [size]="26" class="text-accent-700" />
        <h2 class="font-heading text-[22px] font-semibold uppercase">Chave pausada</h2>
        <p class="font-heading text-[18px] font-semibold uppercase">{{ pausedLabel() }}</p>
        <p class="text-[14px]">Um admin registra quem venceu. A tela atualiza sozinha.</p>
      </app-blueprint>
    }

    @switch (tab()) {
      @case ('queue') {
        <div class="flex flex-col gap-5 pb-6">
          @if (current(); as bracket) {
            <app-hero-field class="mt-4" kicker="01 · AGORA" [live]="true">
              <p class="text-[13px] text-accent-200">{{ currentPhase() }}</p>
              <div class="flex flex-col gap-1">
                @for (side of currentSides(); track side.teamId) {
                  <p class="flex items-center gap-2">
                    <span class="font-heading text-[26px] leading-none font-semibold uppercase">{{
                      side.label
                    }}</span>
                    @if (side.note) {
                      <span class="tag border border-accent-400 text-accent-200">{{
                        side.note
                      }}</span>
                    }
                  </p>
                }
              </div>
              @if (canReport()) {
                <button type="button" class="btn btn-inverted" (click)="openScore(bracket)">
                  <app-icon name="square-pen" [size]="20" />
                  LANÇAR PLACAR
                </button>
                @if (!group.isAdmin()) {
                  <p class="text-[13px] text-accent-200">
                    Qualquer jogador desta partida pode lançar. O primeiro placar salvo trava.
                  </p>
                }
              }
            </app-hero-field>
          }

          @if (upcoming().length > 0) {
            <section class="px-4">
              <app-section-band label="A SEGUIR" />
              @for (bracket of upcoming(); track $index) {
                <div class="row-rule flex items-center gap-3 py-[11px]">
                  <span class="text-[12px] tracking-[0.06em] uppercase muted">{{
                    phaseOf(bracket)
                  }}</span>
                  <span class="flex-1 font-heading text-[17px] font-semibold uppercase">
                    {{ store.teamLabel(bracket.teamAId) }}
                    <span class="muted">× {{ store.teamLabel(bracket.teamBId) }}</span>
                  </span>
                  <span class="tag tag-neutral">aguarda</span>
                </div>
              }
            </section>
          }

          <section class="px-4">
            <app-section-band label="CONCLUÍDOS" [meta]="resultsMeta()" />
            <div class="flex flex-col gap-3">
              @for (result of store.results(); track result.match.id) {
                <app-blueprint>
                  <p
                    class="flex items-center gap-2 border-b border-hairline px-3 py-2 text-[12px] muted"
                  >
                    {{ result.phaseLabel.toUpperCase() }} · {{ time(result.match.playedAt) }}
                    @if (result.reportedByName) {
                      <span class="flex items-center gap-1">
                        <app-icon name="lock" [size]="12" />
                        {{ result.reportedByName }}
                      </span>
                    }
                  </p>
                  <div class="flex items-baseline gap-2 px-3 py-2">
                    <span class="flex-1 font-heading text-[17px] font-semibold uppercase">{{
                      result.winnerLabel
                    }}</span>
                    @if (result.winnerConsequence) {
                      <span class="tag tag-accent">{{ result.winnerConsequence }}</span>
                    }
                    <span class="font-heading text-[24px] font-semibold tnum">{{
                      result.winnerScore
                    }}</span>
                  </div>
                  <div class="flex items-baseline gap-2 px-3 pb-2 muted">
                    <span class="flex-1 font-heading text-[17px] font-semibold uppercase">{{
                      result.loserLabel
                    }}</span>
                    @if (result.loserConsequence) {
                      <span class="tag tag-neutral">{{ result.loserConsequence }}</span>
                    }
                    <span class="font-heading text-[24px] font-semibold tnum">{{
                      result.loserScore
                    }}</span>
                  </div>
                  @if (group.isAdmin()) {
                    <button
                      type="button"
                      class="flex items-center gap-1 px-3 pb-2 text-[13px] text-accent-700"
                      (click)="correct(result.match.id)"
                    >
                      <app-icon name="pencil" [size]="14" />
                      Corrigir
                    </button>
                  }
                </app-blueprint>
              } @empty {
                <p class="text-[14px] muted">Nenhuma partida concluída ainda.</p>
              }
            </div>
          </section>

          @if (placementEvent(); as event) {
            <div class="px-4">
              <app-inline-note tone="event" icon="hand">{{ event }}</app-inline-note>
            </div>
          }
        </div>
      }

      @case ('bracket') {
        <div class="flex flex-col gap-4 px-4 py-4 pb-6">
          @if (myTeamNote(); as note) {
            <app-inline-note tone="positive">{{ note }}</app-inline-note>
          }

          @if (encaixeNote(); as note) {
            <div class="border border-dashed border-neutral-500 p-3">
              <p class="flex items-center gap-2 kicker">
                <app-icon name="git-merge" [size]="16" />
                ENCAIXE
              </p>
              <p class="mt-1 text-[14px]">{{ note }}</p>
            </div>
          }

          <section>
            <app-section-band label="ESCADA ATÉ A FINAL" [meta]="progressMeta()" />
            <app-ladder [steps]="store.ladder()" [championLabel]="championLabel()" />
          </section>

          @if (outNote(); as note) {
            <p class="text-[13px] muted">{{ note }}</p>
          }
        </div>
      }

      @case ('teams') {
        <ul class="list-none p-0 pb-6">
          @for (row of teamRows(); track row.teamId) {
            <li class="row-rule flex items-center gap-3 px-4 py-3">
              <span class="flex-1 font-heading text-[17px] font-semibold uppercase">{{
                row.label
              }}</span>
              <span class="tag" [class]="row.tagClass">{{ row.state }}</span>
            </li>
          }
        </ul>
      }
    }

    @if (scoreTarget(); as bracket) {
      <app-score-sheet [bracket]="bracket" (closed)="closeScore()" />
    }

    @if (group.isAdmin() && store.tiebreak()) {
      <app-tiebreak-sheet (choose)="resolveTiebreak($event)" />
    } @else if (group.isAdmin() && store.placementCandidate()) {
      <app-placement-sheet (choose)="applyPlacement($event)" />
    }
  `,
  host: { class: 'block' },
})
export class TournamentLiveComponent implements OnInit {
  private readonly router = inject(Router);
  protected readonly group = inject(CurrentGroupStore);
  protected readonly store = inject(LiveTournamentStore);

  readonly tournamentId = input.required<string>();

  protected readonly tab = signal<Tab>('queue');
  protected readonly scoreTarget = signal<BracketMatch | null>(null);

  protected readonly tabs = [
    { id: 'queue', label: 'Fila' },
    { id: 'bracket', label: 'Chave' },
    { id: 'teams', label: 'Duplas' },
  ];

  protected readonly context = computed(() => {
    const status = this.store.tournament()?.status === 'completed' ? 'FINALIZADO' : 'AO VIVO';
    return `CAMPEONATO · ${status}`;
  });

  /** A partida de agora só existe se a chave não está pausada. */
  protected readonly current = computed(() =>
    this.store.paused() ? null : this.store.currentMatch(),
  );

  protected readonly currentPhase = computed(() => {
    const bracket = this.current();
    return bracket ? this.phaseOf(bracket) : '';
  });

  protected readonly currentSides = computed(() => {
    const bracket = this.current();
    if (!bracket) {
      return [];
    }

    return [bracket.teamAId, bracket.teamBId].map((teamId) => ({
      teamId,
      label: this.store.teamLabel(teamId),
      note: this.noteFor(teamId),
    }));
  });

  /** Admin lança qualquer partida; jogador, só a dele e só se ainda não houver placar. */
  protected readonly canReport = computed(() => {
    const bracket = this.current();
    if (!bracket || this.store.findSavedMatch(bracket)) {
      return false;
    }
    return this.group.isAdmin() || this.store.myMatch() === bracket;
  });

  protected readonly upcoming = computed(() => this.store.pending().slice(1));

  protected readonly resultsMeta = computed(() => {
    const tournament = this.store.tournament();
    if (!tournament) {
      return null;
    }
    return `${tournament.pointLimit} pts · ${tournament.thirdPlaceEnabled ? 'com' : 'sem'} 3º lugar`;
  });

  protected readonly progressMeta = computed(() => {
    const played = this.store.completedMatches().length;
    const total = this.store.ladder().length;
    return `${played} de ${total} jogos`;
  });

  protected readonly championLabel = computed(() => {
    const tournament = this.store.tournament();
    const champion = tournament?.finalStandings.find((standing) => standing.position === 1);
    return champion ? this.store.teamLabel(champion.teamId) : null;
  });

  protected readonly pausedLabel = computed(() => {
    const tiebreak = this.store.tiebreak();
    if (tiebreak) {
      return `DESEMPATE: ${tiebreak.teamIds.map((id) => this.store.teamLabel(id)).join(' × ')}`;
    }

    const candidate = this.store.placementCandidate();
    if (candidate) {
      const names = candidate.playerIds.map((id) => this.store.playerName(id) ?? '?');
      return `PAR-OU-ÍMPAR NA QUADRA: ${names.join(' × ').toUpperCase()}`;
    }

    return '';
  });

  /** A nota do jogador: com quem ele está e quantas vitórias faltam. */
  protected readonly myTeamNote = computed(() => {
    if (this.group.isAdmin()) {
      return null;
    }

    const team = this.store.myTeam();
    if (!team) {
      return null;
    }

    const partnerId = team.playerIds.find((playerId) => playerId !== this.group.playerId());
    const partner = this.store.playerName(partnerId ?? null);
    const remaining = this.store.ladder().filter((step) => step.state !== 'done').length;

    return `Você está com ${partner}. ${remaining === 0 ? 'Acabou.' : `Faltam ${remaining} vitórias para o título.`}`;
  });

  protected readonly encaixeNote = computed(() => {
    const tournament = this.store.tournament();
    const placement = tournament?.oddPlayerPlacement;
    if (!placement) {
      return null;
    }

    const surviving = this.store.playerName(placement.survivingPlayerId);
    const eliminated = this.store.playerName(placement.eliminatedPlayerId);
    const waiting = this.store.playerName(tournament?.waitingPlayerId ?? null);

    return `${this.store.teamLabel(placement.encaixeTeamId)} · ${surviving} venceu o par-ou-ímpar · ${waiting} era a avulsa · ${eliminated} fora`;
  });

  protected readonly outNote = computed(() => {
    const tournament = this.store.tournament();
    if (!tournament) {
      return null;
    }

    const parts = tournament.teams
      .filter((team) => team.eliminatedDirectly)
      .map((team) => `${this.store.teamLabel(team.id)} (eliminação direta)`);

    const placement = tournament.oddPlayerPlacement;
    if (placement) {
      parts.push(`${this.store.playerName(placement.eliminatedPlayerId)} (par-ou-ímpar)`);
    }

    return parts.length > 0 ? `Fora: ${parts.join(' · ')}.` : null;
  });

  protected readonly placementEvent = computed(() => {
    const tournament = this.store.tournament();
    const placement = tournament?.oddPlayerPlacement;
    if (!placement?.decidedAt) {
      return null;
    }

    const surviving = this.store.playerName(placement.survivingPlayerId);
    const eliminated = this.store.playerName(placement.eliminatedPlayerId);
    const waiting = this.store.playerName(tournament?.waitingPlayerId ?? null);
    const decidedBy = this.store.playerName(placement.decidedBy);

    return `Par-ou-ímpar: ${surviving} venceu e joga com ${waiting}. ${eliminated} está fora e entra com prioridade no próximo sorteio.${decidedBy ? ` Decidido por ${decidedBy} · ${formatTime(placement.decidedAt)}` : ''}`;
  });

  /** A aba Duplas: o estado de cada dupla do campeonato. */
  protected readonly teamRows = computed(() => {
    const tournament = this.store.tournament();
    if (!tournament) {
      return [];
    }

    const placement = tournament.oddPlayerPlacement;

    return tournament.teams.map((team) => {
      let state = 'em jogo';
      let tagClass = 'tag-accent';

      if (team.id === placement?.encaixeTeamId) {
        state = 'encaixe';
        tagClass = 'tag-accent';
      } else if (team.id === placement?.sourceTeamId) {
        state = 'desfeita no encaixe';
        tagClass = 'tag-neutral';
      } else if (team.eliminatedDirectly) {
        state = 'eliminada direto';
        tagClass = 'tag-neutral';
      } else if (team.eliminated) {
        state = 'fora';
        tagClass = 'tag-neutral';
      }

      return { teamId: team.id, label: this.store.teamLabel(team.id), state, tagClass };
    });
  });

  async ngOnInit(): Promise<void> {
    await this.store.load(this.tournamentId());

    // Campeonato que já terminou abre na classificação.
    if (this.store.tournament()?.status === 'completed') {
      void this.router.navigate([
        '/g',
        this.group.groupId(),
        'campeonatos',
        this.tournamentId(),
        'classificacao',
      ]);
    }
  }

  protected phaseOf(bracket: BracketMatch): string {
    return this.store.ladder().find((step) => step.phase === bracket.phase)?.phaseLabel ?? '';
  }

  protected time(iso: string): string {
    return formatTime(iso);
  }

  protected noteFor(teamId: string): string | null {
    return (
      this.store
        .ladder()
        .flatMap((step) => [step.a, step.b])
        .find((side) => side.teamId === teamId)?.note ?? null
    );
  }

  protected openScore(bracket: BracketMatch): void {
    this.scoreTarget.set(bracket);
  }

  protected async closeScore(): Promise<void> {
    this.scoreTarget.set(null);
    await this.store.reload();

    if (this.store.tournament()?.status === 'completed') {
      void this.router.navigate([
        '/g',
        this.group.groupId(),
        'campeonatos',
        this.tournamentId(),
        'classificacao',
      ]);
    }
  }

  /** Corrigir é reabrir o placar da partida — só admin chega aqui. */
  protected correct(matchId: string): void {
    const match = this.store.matches().find((candidate) => candidate.id === matchId);
    if (!match) {
      return;
    }
    this.scoreTarget.set({
      phase: match.phase,
      teamAId: match.teamAId,
      teamBId: match.teamBId,
    });
  }

  protected async applyPlacement(survivingPlayerId: string): Promise<void> {
    await this.store.applyPlacement(survivingPlayerId);
  }

  protected async resolveTiebreak(winnerTeamId: string): Promise<void> {
    await this.store.resolveTiebreak(winnerTeamId);
  }

  protected back(): void {
    void this.router.navigate(['/g', this.group.groupId(), 'campeonatos']);
  }
}
