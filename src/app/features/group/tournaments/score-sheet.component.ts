import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { BracketMatch } from '../../../core/services/tournament.service';
import { LiveTournamentStore } from '../../../core/stores/live-tournament.store';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import { phaseLabel } from '../../../core/rules/bracket-phases';
import { Match } from '../../../shared/models';
import { formatTime } from '../../../shared/utils/date.util';
import {
  ActionBarComponent,
  FocusTrapDirective,
  BlueprintComponent,
  IconComponent,
  InlineNoteComponent,
  StepperComponent,
} from '../../../shared/ui';

/**
 * Lançar placar (1n/1o/1p).
 *
 * Quem está na partida pode lançar, e **o primeiro placar salvo trava**: a
 * correção depois é só de admin. Empate e 0 × 0 não salvam; abaixo do limite, o
 * app pede confirmação em vez de recusar.
 */
@Component({
  selector: 'app-score-sheet',
  imports: [
    ActionBarComponent,
    BlueprintComponent,
    FocusTrapDirective,
    IconComponent,
    InlineNoteComponent,
    StepperComponent,
  ],
  template: `
    <div
      class="fixed inset-0 z-40 mx-auto flex max-w-[480px] flex-col bg-bg"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="sheetTitle()"
      appFocusTrap
      (escape)="closed.emit()"
    >
      <header class="flex items-start justify-between gap-2 px-4 pt-4 pb-3">
        <div>
          <p class="kicker">{{ kicker() }}</p>
          <h2 class="title-lg mt-1">{{ sheetTitle() }}</h2>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-icon border-0"
          aria-label="Fechar"
          (click)="closed.emit()"
        >
          <app-icon name="x" [size]="24" />
        </button>
      </header>

      <div class="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
        @if (saved(); as savedMatch) {
          <app-blueprint>
            <p class="flex items-center gap-2 border-b border-hairline px-3 py-2 text-[12px] muted">
              <app-icon name="lock" [size]="14" />
              TRAVADO · lançado por {{ reporterLabel() }} às {{ time(savedMatch.playedAt) }}
            </p>
            @for (row of savedRows(); track row.label) {
              <div class="flex items-baseline gap-2 px-3 py-3" [class.muted]="!row.won">
                <span
                  class="flex-1 font-heading text-[26px] leading-none font-semibold uppercase"
                  >{{ row.label }}</span
                >
                <span class="font-heading text-[44px] leading-none font-semibold tnum">{{
                  row.score
                }}</span>
              </div>
            }
          </app-blueprint>

          <p class="text-[14px]">
            Errou algum número? Só um admin corrige —
            <strong class="font-semibold">{{ adminNames() }}</strong
            >.
          </p>
        } @else {
          @if (!isAdmin()) {
            <app-inline-note tone="event" icon="lock">
              Você joga esta partida e pode lançar.
              <strong class="font-semibold">O primeiro placar salvo trava</strong> — depois, só
              {{ adminNames() }} ({{ adminWord() }}) corrigem.
            </app-inline-note>
          }

          @for (side of sides(); track side.teamId) {
            <app-blueprint [selected]="side.winning">
              <div class="flex flex-col gap-2 p-3">
                <span class="flex items-center justify-between gap-2">
                  <span class="kicker">{{ side.origin }}</span>
                  @if (side.winning) {
                    <span class="text-[12px] font-semibold text-accent-700">vence</span>
                  }
                </span>
                <span class="font-heading text-[26px] leading-none font-semibold uppercase">{{
                  side.label
                }}</span>
                @if (side.teamId === bracket().teamAId) {
                  <app-stepper label="pontos da primeira dupla" [(value)]="scoreA" [large]="true" />
                } @else {
                  <app-stepper label="pontos da segunda dupla" [(value)]="scoreB" [large]="true" />
                }
              </div>
            </app-blueprint>
          }

          @if (error(); as message) {
            <app-inline-note tone="error">{{ message }}</app-inline-note>
          } @else if (preview(); as message) {
            <app-inline-note tone="positive">{{ message }}</app-inline-note>
          }

          <p class="text-[13px] muted">
            Limite: {{ pointLimit() }} pontos. Sem empate, sem 0 × 0. Abaixo do limite o app pede
            confirmação.
          </p>
        }
      </div>

      @if (!saved()) {
        <app-action-bar>
          <button
            type="button"
            class="btn btn-primary blueprint h-14 text-[17px]"
            [disabled]="!!error() || busy()"
            (click)="save()"
          >
            <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i>
            <i class="corner br"></i>
            {{ correcting() ? 'CORRIGIR' : 'SALVAR' }} {{ scoreA() }} × {{ scoreB() }}
          </button>
        </app-action-bar>
      } @else {
        <app-action-bar [pair]="true">
          <button type="button" class="btn btn-secondary h-13" (click)="notifyAdmin()">
            <app-icon name="send" [size]="18" />
            AVISAR ADMIN
          </button>
          <button
            type="button"
            class="btn btn-primary blueprint h-13 text-[17px]"
            (click)="closed.emit()"
          >
            <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i>
            <i class="corner br"></i>
            VER CHAVE
          </button>
        </app-action-bar>
      }
    </div>

    @if (confirming()) {
      <div class="dialog-backdrop items-center">
        <app-blueprint class="dialog" role="dialog" aria-modal="true" aria-label="Confirmar placar">
          <h3 class="font-heading text-[20px] font-semibold uppercase">Abaixo do limite</h3>
          <p class="text-[14px]">
            O vencedor fez {{ maxScore() }}, abaixo do limite de {{ pointLimit() }}. Salvar mesmo
            assim?
          </p>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="btn btn-secondary" (click)="confirming.set(false)">
              VOLTAR
            </button>
            <button type="button" class="btn btn-primary" (click)="commit()">SALVAR</button>
          </div>
        </app-blueprint>
      </div>
    }
  `,
})
export class ScoreSheetComponent {
  private readonly store = inject(LiveTournamentStore);
  private readonly group = inject(CurrentGroupStore);

  readonly bracket = input.required<BracketMatch>();
  /** Partida já lançada que o admin está corrigindo. */
  readonly correcting = input<Match | null>(null);
  readonly closed = output<void>();

  protected readonly scoreA = signal(0);
  protected readonly scoreB = signal(0);
  protected readonly busy = signal(false);
  protected readonly confirming = signal(false);
  /** Preenchido depois de salvar: a tela vira "placar travado". */
  protected readonly saved = signal<Match | null>(null);

  protected readonly isAdmin = this.group.isAdmin;
  protected readonly adminNames = this.group.adminNames;
  protected readonly adminWord = computed(() =>
    this.group.admins().length > 1 ? 'admins' : 'admin',
  );

  protected readonly pointLimit = computed(() => this.store.tournament()?.pointLimit ?? 12);

  protected readonly sheetTitle = computed(() => {
    if (this.saved()) {
      return 'PLACAR SALVO';
    }
    return this.correcting() ? 'CORRIGIR PLACAR' : 'PLACAR FINAL';
  });

  constructor() {
    // Corrigir parte do placar que está lá, não do zero.
    effect(() => {
      const match = this.correcting();
      if (match) {
        this.scoreA.set(match.scoreA);
        this.scoreB.set(match.scoreB);
      }
    });
  }

  protected readonly kicker = computed(
    () =>
      `${phaseLabel(this.bracket().phase).toUpperCase()} · ${this.store.tournament()?.name?.toUpperCase() ?? ''}`,
  );

  protected readonly maxScore = computed(() => Math.max(this.scoreA(), this.scoreB()));

  protected readonly error = computed(() => {
    if (this.scoreA() === this.scoreB()) {
      return this.scoreA() === 0
        ? 'Ninguém jogou 0 × 0. Lance o placar da partida.'
        : 'Vôlei não tem empate. Ajuste o placar para salvar.';
    }
    return null;
  });

  protected readonly sides = computed(() => {
    const bracket = this.bracket();
    const scoreA = this.scoreA();
    const scoreB = this.scoreB();
    const playerId = this.group.playerId();

    return [bracket.teamAId, bracket.teamBId].map((teamId) => {
      const isA = teamId === bracket.teamAId;
      const score = isA ? scoreA : scoreB;
      const other = isA ? scoreB : scoreA;
      const mine = this.store.teamHas(teamId, playerId);

      return {
        teamId,
        label: this.store.teamLabel(teamId),
        origin: mine ? `VOCÊ · ${this.origin(teamId)}` : this.origin(teamId),
        winning: score > other,
      };
    });
  });

  /** O que o resultado produz em seguida, dito em palavras. */
  protected readonly preview = computed(() => {
    if (this.error()) {
      return null;
    }

    const bracket = this.bracket();
    const winnerId = this.scoreA() > this.scoreB() ? bracket.teamAId : bracket.teamBId;
    const diff = Math.abs(this.scoreA() - this.scoreB());
    const winner = this.store.teamLabel(winnerId);

    const nextPhases = this.store
      .ladder()
      .filter((step) => step.state === 'later' || step.state === 'next');
    const nextPhase = nextPhases[0];

    if (!nextPhase) {
      return `${winner} vence por ${diff}.`;
    }

    return `${winner} vence por ${diff} e vai à ${nextPhase.phaseLabel.toLowerCase()}.`;
  });

  protected readonly savedRows = computed(() => {
    const match = this.saved();
    if (!match) {
      return [];
    }

    return [
      {
        label: this.store.teamLabel(match.teamAId),
        score: match.scoreA,
        won: match.winnerId === match.teamAId,
      },
      {
        label: this.store.teamLabel(match.teamBId),
        score: match.scoreB,
        won: match.winnerId === match.teamBId,
      },
    ].sort((a, b) => Number(b.won) - Number(a.won));
  });

  protected readonly reporterLabel = computed(() => {
    const match = this.saved();
    if (!match) {
      return '';
    }
    return match.reportedBy === this.group.playerId()
      ? 'você'
      : (this.store.playerName(match.reportedBy) ?? 'alguém');
  });

  protected time(iso: string): string {
    return formatTime(iso);
  }

  protected async save(): Promise<void> {
    if (this.error()) {
      return;
    }

    if (this.maxScore() < this.pointLimit()) {
      this.confirming.set(true);
      return;
    }

    await this.commit();
  }

  protected async commit(): Promise<void> {
    this.confirming.set(false);
    this.busy.set(true);
    try {
      const correcting = this.correcting();
      if (correcting) {
        // Correção é UPDATE, e fica registrado quem corrigiu.
        await this.store.correctScore(
          correcting.id,
          this.scoreA(),
          this.scoreB(),
          this.group.playerId(),
        );
        this.closed.emit();
        return;
      }

      const result = await this.store.reportScore(
        this.bracket(),
        this.scoreA(),
        this.scoreB(),
        this.group.playerId(),
      );

      // Outro aparelho chegou primeiro: mostra o placar que já está salvo.
      const match = result.existing ?? this.store.findSavedMatch(this.bracket());

      if (this.isAdmin() && result.saved) {
        this.closed.emit();
        return;
      }

      this.saved.set(match);
    } finally {
      this.busy.set(false);
    }
  }

  /** Manda o resultado pelo WhatsApp, com o texto pronto. */
  protected notifyAdmin(): void {
    const match = this.saved();
    if (!match) {
      return;
    }

    const text = `${this.store.tournament()?.name}: ${this.store.teamLabel(match.teamAId)} ${match.scoreA} × ${match.scoreB} ${this.store.teamLabel(match.teamBId)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  /** "DUPLA DO ENCAIXE", "BYE", "RODADA 1". */
  private origin(teamId: string): string {
    const tournament = this.store.tournament();
    if (tournament?.oddPlayerPlacement?.encaixeTeamId === teamId) {
      return 'DUPLA DO ENCAIXE';
    }

    const note = this.store
      .ladder()
      .flatMap((step) => [step.a, step.b])
      .find((side) => side.teamId === teamId)?.note;

    return note?.toUpperCase() ?? 'RODADA 1';
  }
}
