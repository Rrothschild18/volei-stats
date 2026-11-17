import { Component, computed, input, model } from '@angular/core';
import { CoinChoice, CourtSide } from '../../../shared/models';
import { MatchOpening, ladoOposto, quemAbreSacando } from '../../../core/rules/match-opening';
import { SegmentedComponent } from '../../../shared/ui';

/** Nada registrado: o estado em que a folha de placar abre. */
export const INICIO_VAZIO: MatchOpening = {
  coinWinnerTeamId: null,
  coinCallerPlayerId: null,
  coinChoice: null,
  teamASide: null,
};

/**
 * O início do jogo, no alto da folha de placar (ticket 07).
 *
 * É **opcional e não trava nada**: quem só quer lançar o resultado rola para
 * os steppers e salva. Por isso não é um passo com botão de PULAR — não
 * responder já é pular, e um passo que precisa ser dispensado atrasa o placar
 * de quem está com o celular na mão no meio do jogo.
 *
 * Quem abre sacando não é perguntado: sai do par-ou-ímpar. Perguntar deixaria o
 * app aceitar uma resposta que contradiz a anterior — e o banco recusaria,
 * tarde demais para quem já tinha respondido.
 */
@Component({
  selector: 'app-match-opening',
  imports: [SegmentedComponent],
  template: `
    <section class="flex flex-col gap-3 border border-divider p-3">
      <div class="flex items-baseline justify-between gap-2">
        <h3 class="kicker">Início do jogo</h3>
        @if (preenchido()) {
          <button type="button" class="text-[13px] text-accent-700" (click)="limpar()">
            Limpar
          </button>
        } @else {
          <span class="text-[12px] muted">opcional</span>
        }
      </div>

      <div class="flex flex-col gap-1">
        <p class="text-[13px] muted" id="par-ou-impar">Quem ganhou o par-ou-ímpar?</p>
        <app-segmented
          aria-labelledby="par-ou-impar"
          [options]="duplas()"
          [value]="opening().coinWinnerTeamId ?? ''"
          (valueChange)="escolherVencedor($event)"
          [tabs]="false"
        />
      </div>

      @if (vencedores().length > 0) {
        <div class="flex flex-col gap-1">
          <p class="text-[13px] muted" id="quem-chamou">Quem chamou?</p>
          <app-segmented
            aria-labelledby="quem-chamou"
            [options]="vencedores()"
            [value]="opening().coinCallerPlayerId ?? ''"
            (valueChange)="patch({ coinCallerPlayerId: $event })"
            [tabs]="false"
          />
        </div>

        <div class="flex flex-col gap-1">
          <p class="text-[13px] muted" id="escolheu">E escolheu…</p>
          <app-segmented
            aria-labelledby="escolheu"
            [options]="escolhas"
            [value]="opening().coinChoice ?? ''"
            (valueChange)="patch({ coinChoice: $any($event) })"
            [tabs]="false"
          />
        </div>
      }

      <div class="flex flex-col gap-1">
        <p class="text-[13px] muted" id="lado-da-quadra">De que lado {{ teamALabel() }} começou?</p>
        <app-segmented
          aria-labelledby="lado-da-quadra"
          [options]="lados"
          [value]="opening().teamASide ?? ''"
          (valueChange)="patch({ teamASide: $any($event) })"
          [tabs]="false"
        />
      </div>

      <p class="text-[13px]" aria-live="polite">
        @if (resumo(); as texto) {
          {{ texto }}
        } @else {
          Ninguém precisa registrar isso para lançar o placar.
        }
      </p>
    </section>
  `,
})
export class MatchOpeningComponent {
  readonly teamAId = input.required<string>();
  readonly teamBId = input.required<string>();
  readonly teamALabel = input.required<string>();
  readonly teamBLabel = input.required<string>();
  /** Os dois jogadores de cada dupla, para saber quem chamou. */
  readonly playersOfTeam =
    input.required<(teamId: string) => readonly { id: string; name: string }[]>();

  readonly opening = model<MatchOpening>(INICIO_VAZIO);

  protected readonly escolhas = [
    { id: 'saque', label: 'Saque' },
    { id: 'lado', label: 'Lado' },
  ];

  protected readonly lados = [
    { id: 'esquerda', label: 'Esquerda' },
    { id: 'direita', label: 'Direita' },
  ];

  protected readonly duplas = computed(() => [
    { id: this.teamAId(), label: this.teamALabel() },
    { id: this.teamBId(), label: this.teamBLabel() },
  ]);

  /** Os dois jogadores da dupla que ganhou o par-ou-ímpar. */
  protected readonly vencedores = computed(() => {
    const teamId = this.opening().coinWinnerTeamId;
    return teamId
      ? this.playersOfTeam()(teamId).map((player) => ({ id: player.id, label: player.name }))
      : [];
  });

  protected readonly preenchido = computed(() => {
    const opening = this.opening();
    return !!(opening.coinWinnerTeamId || opening.teamASide);
  });

  /** O que foi registrado, em uma frase — incluindo quem abre sacando. */
  protected readonly resumo = computed(() => {
    const opening = this.opening();
    const partes: string[] = [];

    const sacador = quemAbreSacando({
      coinWinnerTeamId: opening.coinWinnerTeamId,
      coinChoice: opening.coinChoice,
      teamAId: this.teamAId(),
      teamBId: this.teamBId(),
    });

    if (sacador) {
      partes.push(`Abre sacando: ${this.rotulo(sacador)}`);
    }

    if (opening.teamASide) {
      partes.push(
        `${this.teamALabel()} à ${opening.teamASide}, ${this.teamBLabel()} à ${ladoOposto(
          opening.teamASide,
        )}`,
      );
    }

    return partes.join(' · ') || null;
  });

  protected escolherVencedor(teamId: string): void {
    // Trocar de dupla invalida quem chamou: o jogador era da outra.
    this.patch({ coinWinnerTeamId: teamId, coinCallerPlayerId: null });
  }

  protected patch(mudanca: Partial<MatchOpening>): void {
    this.opening.update((atual) => ({ ...atual, ...mudanca }));
  }

  protected limpar(): void {
    this.opening.set(INICIO_VAZIO);
  }

  private rotulo(teamId: string): string {
    return teamId === this.teamAId() ? this.teamALabel() : this.teamBLabel();
  }
}

export type { CoinChoice, CourtSide };
