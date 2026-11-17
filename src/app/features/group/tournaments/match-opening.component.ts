import { Component, computed, effect, input, model, signal, untracked } from '@angular/core';
import { MatchOpening, ladoOposto, quemAbreSacando } from '../../../core/rules/match-opening';
import { IconComponent, SegmentedComponent } from '../../../shared/ui';

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
  imports: [IconComponent, SegmentedComponent],
  template: `
    <section class="border border-divider">
      <!--
        Uma linha só quando fechado: depois de registrado, o início do jogo não
        precisa mais ocupar a tela de quem está contando ponto.
      -->
      <button
        type="button"
        class="flex w-full items-center gap-2 p-3 text-left"
        [attr.aria-expanded]="aberto()"
        aria-controls="inicio-do-jogo"
        (click)="aberto.set(!aberto())"
      >
        <span class="min-w-0 flex-1">
          <span class="kicker block">Início do jogo</span>
          @if (!aberto()) {
            <span class="block truncate text-[13px]">
              {{ resumo() ?? 'Par-ou-ímpar, lado e saque — opcional' }}
            </span>
          }
        </span>
        @if (aberto() && !preenchido()) {
          <span class="text-[12px] muted">opcional</span>
        }
        <app-icon [name]="aberto() ? 'chevron-down' : 'chevron-right'" [size]="18" class="muted" />
      </button>

      @if (aberto()) {
        <div id="inicio-do-jogo" class="flex flex-col gap-3 px-3 pb-3">
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
            <p class="text-[13px] muted" id="lado-da-quadra">
              De que lado {{ teamALabel() }} começou?
            </p>
            <app-segmented
              aria-labelledby="lado-da-quadra"
              [options]="lados"
              [value]="opening().teamASide ?? ''"
              (valueChange)="patch({ teamASide: $any($event) })"
              [tabs]="false"
            />
          </div>

          <p class="flex items-baseline justify-between gap-2 text-[13px]" aria-live="polite">
            <span>
              @if (resumo(); as texto) {
                {{ texto }}
              } @else {
                Ninguém precisa registrar isso para lançar o placar.
              }
            </span>
            @if (preenchido()) {
              <button type="button" class="shrink-0 text-accent-700" (click)="limpar()">
                Limpar
              </button>
            }
          </p>
        </div>
      }
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

  /**
   * Aberto até ser respondido. Com par-ou-ímpar, escolha e lado registrados o
   * bloco se fecha sozinho numa linha — e tocar nela reabre para corrigir.
   */
  protected readonly aberto = signal(true);

  private readonly completo = computed(() => {
    const opening = this.opening();
    return !!(opening.coinWinnerTeamId && opening.coinChoice && opening.teamASide);
  });

  constructor() {
    // Só o MOMENTO em que fica completo fecha: quem reabriu para corrigir uma
    // resposta não tem o bloco fechado na cara a cada toque.
    effect(() => {
      if (this.completo()) {
        untracked(() => this.aberto.set(false));
      }
    });
  }

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
