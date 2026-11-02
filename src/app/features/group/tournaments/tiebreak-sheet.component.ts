import { Component, computed, inject, input, output } from '@angular/core';
import { LiveTournamentStore } from '../../../core/stores/live-tournament.store';
import { BottomSheetComponent, BusyDirective, InlineNoteComponent } from '../../../shared/ui';

/**
 * Empate na diferença de pontos (1r), REGRAS.md §9.3.
 *
 * Quando duas duplas empatam exatamente na posição que decide, não existe
 * critério no app. Elas fazem par-ou-ímpar na quadra e quem está lá registra. Entre
 * perdedoras, quem perde o par-ou-ímpar é eliminada direto; entre vencedoras,
 * quem vence vai direto à final.
 */
@Component({
  selector: 'app-tiebreak-sheet',
  imports: [BottomSheetComponent, BusyDirective, InlineNoteComponent],
  template: `
    <app-bottom-sheet kicker="DESEMPATE" title="EMPATE NA DIFERENÇA" [dismissible]="false">
      <!--
        A folha é três coisas, e a distância entre elas é que diz isso: POR QUE
        a chave parou, COMO ficou a rodada, e A ESCOLHA. Com tudo no mesmo
        espaçamento (o gap do diálogo), as três viravam um bloco só de texto e
        caixas — era preciso ler a folha inteira para achar onde responder.
      -->
      <div class="flex flex-col gap-7 pt-1">
        <!-- Por quê: o aviso e a explicação são uma coisa só, e andam juntos. -->
        <div class="flex flex-col gap-3">
          @if (note(); as message) {
            <app-inline-note tone="event">{{ message }}</app-inline-note>
          }
          <p class="text-[15px] leading-relaxed">{{ explanation() }}</p>
        </div>

        <!-- Os números que empataram. -->
        <section class="border border-divider">
          <p class="kicker row-rule px-4 py-3">COMO FICOU A RODADA 1</p>
          @for (row of rows(); track row.teamId; let last = $last) {
            <div class="flex items-center gap-4 px-4 py-[18px]" [class.row-rule]="!last">
              <span class="team-name min-w-0 flex-1">{{ row.label }}</span>
              <span class="text-[13px] tnum muted">{{ row.score }}</span>
              <span class="figure w-14 text-right text-[22px]">{{ row.diff }}</span>
            </div>
          }
        </section>

        <!-- A escolha, separada por uma linha: daqui para baixo é o que fazer. -->
        <section class="flex flex-col gap-4 border-t border-divider pt-7">
          <p class="kicker">QUEM VENCEU O PAR-OU-ÍMPAR?</p>

          <div class="grid grid-cols-2 gap-3">
            @for (row of rows(); track row.teamId) {
              <button
                type="button"
                class="btn btn-secondary h-18 px-3"
                [appBusy]="registering() === row.teamId"
                [disabled]="registering() !== null"
                (click)="choose.emit(row.teamId)"
              >
                <span class="team-name text-[19px] leading-tight">{{ row.label }}</span>
              </button>
            }
          </div>

          <p class="text-[12px] leading-relaxed muted">{{ footer() }}</p>
        </section>
      </div>
    </app-bottom-sheet>
  `,
})
export class TiebreakSheetComponent {
  private readonly store = inject(LiveTournamentStore);

  /**
   * A dupla cuja vitória está sendo gravada. Vem de fora porque quem grava é a
   * tela do ao vivo: se a gravação falha, é ela que solta os botões de novo —
   * um estado aqui dentro deixaria a folha travada para sempre.
   */
  readonly registering = input<string | null>(null);

  /**
   * Por que a chave pausou **de novo**.
   *
   * Sem isto, uma correção que derruba o par-ou-ímpar devolve esta mesma folha
   * sem nada dito, e quem já tinha decidido na quadra não liga uma coisa à
   * outra (ticket 35).
   */
  readonly note = input<string | null>(null);

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
