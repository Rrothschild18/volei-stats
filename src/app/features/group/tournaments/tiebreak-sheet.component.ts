import { Component, computed, inject, output } from '@angular/core';
import { LiveTournamentStore } from '../../../core/stores/live-tournament.store';
import { BottomSheetComponent } from '../../../shared/ui';

/**
 * Empate na diferença de pontos (1r), REGRAS.md §9.3.
 *
 * Quando duas duplas empatam exatamente na posição que decide, não existe
 * critério no app. Elas fazem par-ou-ímpar na quadra e o admin registra. Entre
 * perdedoras, quem perde o par-ou-ímpar é eliminada direto; entre vencedoras,
 * quem vence vai direto à final.
 */
@Component({
  selector: 'app-tiebreak-sheet',
  imports: [BottomSheetComponent],
  template: `
    <app-bottom-sheet kicker="DESEMPATE" title="EMPATE NA DIFERENÇA" [dismissible]="false">
      <div class="border border-divider">
        @for (row of rows(); track row.teamId; let last = $last) {
          <div class="flex items-baseline gap-2 px-3 py-2" [class.row-rule]="!last">
            <span class="flex-1 font-heading text-[17px] font-semibold uppercase">{{
              row.label
            }}</span>
            <span class="text-[13px] tnum muted">{{ row.score }} · {{ row.diff }}</span>
          </div>
        }
      </div>

      <p class="text-[14px]">{{ explanation() }}</p>

      <p class="kicker">QUEM VENCEU O PAR-OU-ÍMPAR?</p>
      <div class="grid grid-cols-2 gap-2">
        @for (row of rows(); track row.teamId) {
          <button
            type="button"
            class="btn btn-secondary py-3"
            style="height: 64px"
            (click)="choose.emit(row.teamId)"
          >
            <span class="font-heading text-[19px] font-semibold uppercase">{{ row.label }}</span>
          </button>
        }
      </div>

      <p class="text-[12px] muted">{{ footer() }}</p>
    </app-bottom-sheet>
  `,
})
export class TiebreakSheetComponent {
  private readonly store = inject(LiveTournamentStore);

  readonly choose = output<string>();

  protected readonly tiebreak = computed(() => this.store.tiebreak());

  protected readonly rows = computed(() => {
    const tiebreak = this.tiebreak();
    if (!tiebreak) {
      return [];
    }

    return tiebreak.teamIds.map((teamId) => {
      const match = this.store
        .matches()
        .find(
          (candidate) =>
            candidate.phase === 'round-1' &&
            [candidate.teamAId, candidate.teamBId].includes(teamId),
        );

      const mine = match?.teamAId === teamId ? match?.scoreA : match?.scoreB;
      const theirs = match?.teamAId === teamId ? match?.scoreB : match?.scoreA;
      const diff = (mine ?? 0) - (theirs ?? 0);

      return {
        teamId,
        label: this.store.teamLabel(teamId),
        score: `${mine ?? 0} × ${theirs ?? 0}`,
        diff: diff > 0 ? `+${diff}` : `${diff}`,
      };
    });
  });

  protected readonly explanation = computed(() => {
    const waiting = this.store.playerName(this.store.tournament()?.waitingPlayerId ?? null);

    if (this.tiebreak()?.kind === 'losers') {
      return waiting
        ? `O app não decide sozinho. Façam um par-ou-ímpar entre as duplas: quem perder é eliminada direto; a outra disputa o encaixe com ${waiting}.`
        : 'O app não decide sozinho. Façam um par-ou-ímpar entre as duplas: quem perder é eliminada direto.';
    }

    return 'O app não decide sozinho. Façam um par-ou-ímpar entre as duplas: quem vencer vai direto à final.';
  });

  protected readonly footer = computed(() =>
    this.tiebreak()?.kind === 'losers'
      ? 'Vale igual para vencedores empatados: quem vence o par-ou-ímpar vai direto à final.'
      : 'A chave fica pausada até a escolha.',
  );
}
