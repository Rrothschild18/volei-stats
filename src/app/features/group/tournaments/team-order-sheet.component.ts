import { Component, computed, inject, input, output, signal } from '@angular/core';
import { LiveTournamentStore } from '../../../core/stores/live-tournament.store';
import {
  BottomSheetComponent,
  BusyDirective,
  IconComponent,
  InlineNoteComponent,
} from '../../../shared/ui';

/**
 * Reordenar as duplas da chave com o campeonato rolando (ticket 44).
 *
 * A ordem das duplas É o confronto: a primeira enfrenta a segunda, a terceira
 * a quarta. Quando ela sai errada — alguém chegou atrasado, a quadra virou, o
 * sorteio foi ajustado de boca —, a única saída era excluir o campeonato e
 * recomeçar, perdendo os placares já lançados.
 *
 * Duas decisões que a folha carrega:
 *
 * - **Subir e descer por botão, e não arrastar.** Arrastar não existe no
 *   teclado nem no leitor de tela, e esta tela precisa passar no AXE.
 * - **Prévia antes de gravar.** Mexer na ordem aqui não salva nada; a lista da
 *   direita mostra os confrontos que a ordem nova produz, e só o botão do fim
 *   grava. Quem reordena está mudando quem joga contra quem — tem de ver isso
 *   antes de confirmar.
 *
 * A dupla que já jogou aparece travada, com o motivo escrito: mover quem já
 * jogou remontaria um confronto que aconteceu, e a partida salva viraria
 * fantasma nas somas (a lição do ticket 35).
 */
@Component({
  selector: 'app-team-order-sheet',
  imports: [BottomSheetComponent, BusyDirective, IconComponent, InlineNoteComponent],
  template: `
    <app-bottom-sheet
      kicker="CHAVE"
      title="ORDEM DAS DUPLAS"
      [dismissible]="!saving()"
      (dismiss)="closed.emit()"
    >
      <div class="flex flex-col gap-6 pt-1">
        <p class="text-[15px] leading-relaxed">
          A ordem é o confronto: a primeira dupla enfrenta a segunda, a terceira a quarta. Mexer
          aqui não grava nada — os confrontos novos aparecem ao lado.
        </p>

        @if (travadas() > 0) {
          <app-inline-note tone="event">
            {{ travadasLabel() }} já jogou e não sai do lugar: mover mudaria um confronto que
            aconteceu, e o placar dele ficaria solto na chave.
          </app-inline-note>
        }

        <section class="border border-divider">
          <p class="kicker row-rule px-4 py-3">DUPLAS · CONFRONTO</p>
          @for (row of rows(); track row.teamId; let last = $last) {
            <div class="flex items-center gap-3 px-3 py-[14px]" [class.row-rule]="!last">
              <span class="figure w-6 text-[15px] muted">{{ row.position }}</span>

              <span class="min-w-0 flex-1">
                <span class="block font-heading text-[16px] leading-tight font-semibold uppercase">
                  {{ row.label }}
                </span>
                <span class="flex items-center gap-1 text-[12px] muted">
                  @if (row.locked) {
                    <app-icon name="lock" [size]="12" />
                  }
                  {{ row.note }}
                </span>
              </span>

              <span class="flex items-center gap-1">
                <button
                  type="button"
                  class="btn btn-ghost btn-icon"
                  [disabled]="!row.canMoveUp || saving()"
                  [attr.aria-label]="'Subir ' + row.label"
                  (click)="move(row.teamId, 'up')"
                >
                  <app-icon name="chevron-down" [size]="20" class="rotate-180" />
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-icon"
                  [disabled]="!row.canMoveDown || saving()"
                  [attr.aria-label]="'Descer ' + row.label"
                  (click)="move(row.teamId, 'down')"
                >
                  <app-icon name="chevron-down" [size]="20" />
                </button>
              </span>
            </div>
          }
        </section>

        <section class="flex flex-col gap-3 border-t border-divider pt-6">
          <p class="kicker">COMO A RODADA FICA</p>
          <ul class="list-none p-0">
            @for (confronto of preview(); track confronto.key) {
              <li class="row-rule flex items-center gap-2 py-[10px] text-[14px]">
                <span class="flex-1 font-heading text-[15px] font-semibold uppercase">{{
                  confronto.label
                }}</span>
                @if (confronto.changed) {
                  <span class="tag tag-accent">novo</span>
                } @else if (confronto.played) {
                  <span class="tag tag-neutral">já jogado</span>
                }
              </li>
            }
          </ul>

          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="btn btn-secondary"
              [disabled]="saving()"
              (click)="closed.emit()"
            >
              CANCELAR
            </button>
            <button
              type="button"
              class="btn btn-primary"
              [appBusy]="saving()"
              [disabled]="!changed() || saving()"
              (click)="save()"
            >
              SALVAR ORDEM
            </button>
          </div>
        </section>
      </div>
    </app-bottom-sheet>
  `,
})
export class TeamOrderSheetComponent {
  private readonly store = inject(LiveTournamentStore);

  /** Gravando: vem de fora porque quem grava é a tela do ao vivo. */
  readonly saving = input(false);

  readonly closed = output<void>();
  readonly apply = output<string[]>();

  /** A ordem em rascunho. Nula enquanto ninguém mexeu em nada. */
  private readonly draft = signal<readonly string[] | null>(null);

  private readonly order = computed(() => this.store.teamOrder());

  /** A ordem de agora: o rascunho, ou a que está gravada. */
  private readonly current = computed<readonly string[]>(
    () => this.draft() ?? this.order().map((slot) => slot.team.id),
  );

  private readonly lockedIds = computed(
    () => new Set(this.order().filter((slot) => slot.locked).map((slot) => slot.team.id)),
  );

  protected readonly travadas = computed(() => this.lockedIds().size);

  protected readonly travadasLabel = computed(() => {
    const total = this.travadas();
    return total === 1 ? '1 dupla' : `${total} duplas`;
  });

  protected readonly changed = computed(() => {
    const gravada = this.order().map((slot) => slot.team.id);
    return this.current().some((id, index) => gravada[index] !== id);
  });

  protected readonly rows = computed(() => {
    const locked = this.lockedIds();
    const ids = this.current();

    return ids.map((teamId, index) => {
      const estaTravada = locked.has(teamId);
      const anterior = ids[index - 1];
      const proxima = ids[index + 1];

      return {
        teamId,
        position: String(index + 1).padStart(2, '0'),
        label: this.store.teamLabel(teamId),
        locked: estaTravada,
        note: estaTravada ? 'já jogou' : this.adversarioLabel(ids, index),
        canMoveUp: !estaTravada && anterior !== undefined && !locked.has(anterior),
        canMoveDown: !estaTravada && proxima !== undefined && !locked.has(proxima),
      };
    });
  });

  /** Os confrontos que a ordem de agora produz, e quais deles mudaram. */
  protected readonly preview = computed(() => {
    const ids = this.current();
    const gravada = this.order().map((slot) => slot.team.id);
    const antes = new Set(this.pares(gravada));

    return this.pares(ids).map((key) => {
      const [a, b] = key.split('|');
      return {
        key,
        label: `${this.store.teamLabel(a)} × ${this.store.teamLabel(b)}`,
        changed: !antes.has(key),
        played: this.store.matches().some((match) => this.par(match.teamAId, match.teamBId) === key),
      };
    });
  });

  protected move(teamId: string, direction: 'up' | 'down'): void {
    const ids = this.current();
    const from = ids.indexOf(teamId);
    const to = direction === 'up' ? from - 1 : from + 1;
    const locked = this.lockedIds();

    if (from < 0 || to < 0 || to >= ids.length || locked.has(ids[from]) || locked.has(ids[to])) {
      return;
    }

    const proxima = [...ids];
    [proxima[from], proxima[to]] = [proxima[to], proxima[from]];
    this.draft.set(proxima);
  }

  protected save(): void {
    this.apply.emit([...this.current()]);
  }

  /**
   * Com quem a dupla desta posição joga, na ordem dada.
   *
   * A última dupla de um número ímpar não tem par: ela entra na fase seguinte
   * sem jogar a rodada inicial, e dizer "joga com ela mesma" seria mentira.
   */
  private adversarioLabel(ids: readonly string[], index: number): string {
    const adversario = index % 2 === 0 ? ids[index + 1] : ids[index - 1];
    return adversario ? `joga com ${this.store.teamLabel(adversario)}` : 'entra sem jogar a rodada';
  }

  /** Os pares da rodada inicial, dois a dois. Uma dupla ímpar sobra de fora. */
  private pares(ids: readonly string[]): string[] {
    const pares: string[] = [];
    for (let index = 0; index + 1 < ids.length; index += 2) {
      pares.push(this.par(ids[index], ids[index + 1]));
    }
    return pares;
  }

  /** O par sem lado: a chave reconhece partida pelas duas duplas, em qualquer ordem. */
  private par(a: string, b: string): string {
    return [a, b].sort().join('|');
  }
}
