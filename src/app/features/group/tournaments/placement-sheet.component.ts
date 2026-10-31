import { Component, computed, inject, output } from '@angular/core';
import { LiveTournamentStore } from '../../../core/stores/live-tournament.store';
import { BottomSheetComponent, IconComponent } from '../../../shared/ui';

/**
 * Par-ou-ímpar do encaixe (1q).
 *
 * A dupla que perdeu a rodada 1 por menos diferença manda um jogador para o
 * encaixe com o avulso; o outro sai e entra com prioridade no próximo sorteio.
 * O app não escolhe: o admin registra quem venceu na quadra, e a chave fica
 * pausada até isso acontecer.
 */
@Component({
  selector: 'app-placement-sheet',
  imports: [BottomSheetComponent, IconComponent],
  template: `
    <app-bottom-sheet
      [kicker]="'ENCAIXE DO AVULSO · ' + (waitingName() ?? '').toUpperCase()"
      [title]="title()"
      [dismissible]="false"
    >
      <p class="text-[14px]">{{ explanation() }}</p>

      @if (directEliminationLabel(); as label) {
        <p class="flex items-start gap-2 text-[13px] muted">
          <app-icon name="trending-down" [size]="18" />
          {{ label }}
        </p>
      }

      <p class="kicker">QUEM VENCEU?</p>
      <div class="grid grid-cols-2 gap-2">
        @for (player of candidates(); track player.id) {
          <button
            type="button"
            class="btn btn-secondary flex-col gap-1 py-3"
            style="height: 76px"
            (click)="choose.emit(player.id)"
          >
            <span class="text-[12px] normal-case opacity-70">venceu</span>
            <span class="font-heading text-[22px] font-semibold uppercase">{{ player.name }}</span>
          </button>
        }
      </div>

      <p class="text-[12px] muted">A chave fica pausada até a escolha.</p>
    </app-bottom-sheet>
  `,
})
export class PlacementSheetComponent {
  private readonly store = inject(LiveTournamentStore);

  readonly choose = output<string>();

  protected readonly candidate = computed(() => this.store.placementCandidate());

  protected readonly waitingName = computed(() =>
    this.store.playerName(this.store.tournament()?.waitingPlayerId ?? null),
  );

  protected readonly candidates = computed(() => {
    const candidate = this.candidate();
    if (!candidate) {
      return [];
    }
    return candidate.playerIds.map((playerId) => ({
      id: playerId,
      name: this.store.playerName(playerId) ?? '?',
    }));
  });

  protected readonly title = computed(() => {
    const names = this.candidates().map((player) => player.name.toUpperCase());
    return `PAR-OU-ÍMPAR: ${names.join(' × ')}`;
  });

  protected readonly explanation = computed(() => {
    const candidate = this.candidate();
    const waiting = this.waitingName();
    if (!candidate) {
      return '';
    }

    const teamLabel = this.store.teamLabel(candidate.sourceTeam.id);
    const round1 = this.store
      .matches()
      .find(
        (match) =>
          match.phase === 'round-1' &&
          [match.teamAId, match.teamBId].includes(candidate.sourceTeam.id),
      );
    const diff = round1?.pointDifference ?? 0;

    return `${teamLabel} perderam por ${diff} — a menor diferença da rodada 1. Quem vencer joga com ${waiting}; quem perder está fora e entra com prioridade no próximo sorteio.`;
  });

  protected readonly directEliminationLabel = computed(() => {
    const candidate = this.candidate();
    if (!candidate?.directEliminationTeamId) {
      return null;
    }

    const teamId = candidate.directEliminationTeamId;
    const round1 = this.store
      .matches()
      .find((match) => match.phase === 'round-1' && match.loserId === teamId);

    return `${this.store.teamLabel(teamId)} perderam por ${round1?.pointDifference ?? 0} e já estão fora (eliminação direta).`;
  });
}
