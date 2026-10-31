import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppFacade } from '../../../core/facade/app.facade';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import { SessionStore } from '../../../core/stores/session.store';
import { DrawService } from '../../../core/services/draw.service';
import { DrawProposal, Player, TournamentPriorityEntry } from '../../../shared/models';
import { formatShortDate } from '../../../shared/utils/date.util';
import {
  ActionBarComponent,
  BlueprintComponent,
  IconComponent,
  InlineNoteComponent,
  InnerHeaderComponent,
  PlayerChipComponent,
  SectionBandComponent,
} from '../../../shared/ui';
import { IconName } from '../../../shared/ui';

interface PriorityRow {
  readonly playerId: string;
  readonly name: string;
  readonly reason: string;
  readonly icon: IconName;
}

interface TeamRow {
  readonly teamId: string;
  readonly order: number;
  readonly players: readonly Player[];
  readonly hasPriority: boolean;
  readonly repeated: boolean;
  /** "JOGO 1", "JOGO 2", "BYE" */
  readonly slot: string;
}

/**
 * Sorteio (1g/1h): três propostas realmente diferentes, as prioridades
 * herdadas do campeonato anterior e a troca de jogadores por toque.
 *
 * A pontuação interna continua ordenando as propostas, mas não aparece em
 * nenhum lugar da tela — o que aparece é o aviso de dupla repetida.
 */
@Component({
  selector: 'app-draw',
  imports: [
    ActionBarComponent,
    BlueprintComponent,
    IconComponent,
    InlineNoteComponent,
    InnerHeaderComponent,
    PlayerChipComponent,
    SectionBandComponent,
  ],
  template: `
    <app-inner-header [context]="context()" title="SORTEIO" (back)="back()" />

    <div class="flex flex-col gap-6 px-4 pb-6">
      @if (priorities().length > 0) {
        <section>
          <app-section-band index="01" label="PRIORIDADES" [meta]="priorityMeta()" />
          @for (row of priorities(); track row.playerId) {
            <div class="row-rule flex h-10 items-center gap-3">
              <app-icon [name]="row.icon" [size]="18" class="text-accent-700" />
              <span class="font-heading text-[17px] font-semibold uppercase">{{ row.name }}</span>
              <span class="flex-1 text-right text-[13px] muted">{{ row.reason }}</span>
            </div>
          }
          <p class="mt-2 text-[12px] muted">Entram na rodada 1 e não podem ficar de espera.</p>
        </section>
      }

      <section>
        <app-section-band index="02" label="PROPOSTAS" [meta]="proposals().length + ' distintas'" />
        <ul class="grid list-none gap-0 p-0" [style.grid-template-columns]="proposalColumns()">
          @for (
            proposal of proposals();
            track proposal.id;
            let index = $index;
            let first = $first
          ) {
            <li class="border border-divider" [class.border-l-0]="!first">
              <button
                type="button"
                class="flex w-full flex-col items-start gap-1 p-3 text-left"
                [class]="index === selectedIndex() ? 'bg-accent-700 text-bg' : ''"
                [attr.aria-pressed]="index === selectedIndex()"
                (click)="select(index)"
              >
                <span class="font-heading text-[24px] leading-none font-semibold">{{
                  letter(index)
                }}</span>
                @if (proposal.waitingPlayerId) {
                  <span class="text-[12px]">espera</span>
                  <span class="text-[14px] font-bold">{{
                    playerName(proposal.waitingPlayerId)
                  }}</span>
                } @else {
                  <span class="text-[12px]">sem avulso</span>
                }
              </button>
            </li>
          }
        </ul>
        <p class="mt-2 text-[12px] muted">{{ proposalNote() }}</p>
      </section>

      @if (repeatedNote(); as note) {
        <app-inline-note tone="positive" icon="repeat">{{ note }}</app-inline-note>
      }

      <section>
        <app-section-band
          index="03"
          [label]="'DUPLAS DA PROPOSTA ' + letter(selectedIndex())"
          meta="ordem da chave"
        />
        <app-blueprint>
          @for (row of teamRows(); track row.teamId; let last = $last) {
            <div class="flex items-center gap-2 px-3 py-[11px]" [class.row-rule]="!last">
              <span class="w-6 font-heading text-[20px] font-semibold text-accent-700 tnum">{{
                row.order
              }}</span>
              <span class="flex min-w-0 flex-1 flex-col gap-1">
                <span class="flex flex-wrap gap-2">
                  @for (player of row.players; track player.id) {
                    <app-player-chip
                      [name]="player.name"
                      [gender]="player.gender"
                      [selectable]="true"
                      [selected]="swapSelection() === player.id"
                      (picked)="tapPlayer(player.id)"
                    />
                  }
                </span>
                @if (row.repeated) {
                  <span class="text-[12px] font-semibold text-accent-800">Dupla repetida hoje</span>
                } @else if (row.hasPriority) {
                  <span class="text-[12px] text-accent-700">Prioridade</span>
                }
              </span>
              <span class="tag tag-neutral">{{ row.slot }}</span>
            </div>
          }
        </app-blueprint>
      </section>

      @if (swapSelection(); as selectedId) {
        <div
          class="flex items-center gap-2 border border-dashed border-accent px-3 py-[11px] text-[14px]"
        >
          <app-icon name="arrow-left-right" [size]="18" class="text-accent-700" />
          <span class="flex-1">
            <strong class="font-semibold">{{ playerName(selectedId) }}</strong> selecionado — toque
            em outro jogador para trocar.
          </span>
          <button
            type="button"
            class="btn btn-ghost btn-icon border-0"
            aria-label="Cancelar troca"
            (click)="swapSelection.set(null)"
          >
            <app-icon name="x" [size]="20" />
          </button>
        </div>
      }
    </div>

    <app-action-bar [pair]="true">
      <button
        type="button"
        class="btn btn-secondary h-13"
        [disabled]="busy()"
        (click)="regenerate()"
      >
        <app-icon name="shuffle" [size]="18" />
        DE NOVO
      </button>
      <button
        type="button"
        class="btn btn-primary blueprint h-13 text-[17px]"
        [disabled]="busy() || proposals().length === 0"
        (click)="useProposal()"
      >
        <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i>
        <i class="corner br"></i>
        USAR PROPOSTA {{ letter(selectedIndex()) }}
      </button>
    </app-action-bar>
  `,
  host: { class: 'block' },
})
export class DrawComponent implements OnInit {
  private readonly facade = inject(AppFacade);
  private readonly draws = inject(DrawService);
  private readonly router = inject(Router);
  private readonly group = inject(CurrentGroupStore);
  private readonly sessionStore = inject(SessionStore);

  readonly sessionId = input.required<string>();

  protected readonly proposals = signal<readonly DrawProposal[]>([]);
  protected readonly selectedIndex = signal(0);
  protected readonly swapSelection = signal<string | null>(null);
  protected readonly busy = signal(false);

  private readonly priorityEntries = signal<readonly TournamentPriorityEntry[]>([]);
  private readonly existingPairs = signal<ReadonlySet<string>>(new Set());
  private readonly drawNumber = signal(1);

  protected readonly context = computed(() => {
    const date = this.sessionStore.session()?.date;
    return `SESSÃO ${date ? '· ' + formatShortDate(date) : ''} · SORTEIO ${this.drawNumber()}`;
  });

  protected readonly selectedProposal = computed(
    () => this.proposals()[this.selectedIndex()] ?? null,
  );

  protected readonly priorities = computed<PriorityRow[]>(() => {
    const byId = this.sessionStore.playersById();
    return this.priorityEntries().map((entry) => ({
      playerId: entry.playerId,
      name: byId.get(entry.playerId)?.name ?? '?',
      reason: this.reasonLabel(entry.reason),
      icon: entry.reason === 'coin-flip-loss' ? 'hand' : 'trending-down',
    }));
  });

  protected readonly priorityMeta = computed(() => {
    const completed = this.sessionStore.completedTournaments();
    return completed.length > 0 ? `do camp. ${completed.length}` : null;
  });

  protected readonly teamRows = computed<TeamRow[]>(() => {
    const proposal = this.selectedProposal();
    if (!proposal) {
      return [];
    }

    const byId = this.sessionStore.playersById();
    const priorityIds = new Set(this.priorityEntries().map((entry) => entry.playerId));
    const pairs = this.existingPairs();
    const teamCount = proposal.teams.length;

    return proposal.teams.map((team, index) => ({
      teamId: team.id,
      order: index + 1,
      players: team.playerIds
        .map((playerId) => byId.get(playerId))
        .filter((player): player is Player => !!player),
      hasPriority: team.playerIds.some((playerId) => priorityIds.has(playerId)),
      repeated: pairs.has(this.draws.getPairKey(team.playerIds[0], team.playerIds[1])),
      slot: this.slotLabel(index, teamCount),
    }));
  });

  /** O aviso de dupla repetida, dizendo quais propostas evitam a dupla. */
  protected readonly repeatedNote = computed(() => {
    const proposal = this.selectedProposal();
    if (!proposal) {
      return null;
    }

    const byId = this.sessionStore.playersById();
    const repeated = this.draws.repeatedPairs(proposal.teams, this.existingPairs());
    if (repeated.length === 0) {
      return null;
    }

    const team = repeated[0];
    const names = team.playerIds.map((playerId) => byId.get(playerId)?.name ?? '?').join(' + ');
    const pairKey = this.draws.getPairKey(team.playerIds[0], team.playerIds[1]);
    const others = this.draws
      .proposalsAvoiding(this.proposals(), pairKey)
      .filter((index) => index !== this.selectedIndex())
      .map((index) => this.letter(index));

    const tail =
      others.length > 0
        ? ` ${others.length === 1 ? 'A proposta' : 'As propostas'} ${others.join(' e ')} evita${others.length === 1 ? '' : 'm'} essa dupla.`
        : ' Nenhuma das outras propostas evita essa dupla.';

    return `${names} já jogaram juntos hoje.${tail}`;
  });

  protected readonly proposalColumns = computed(
    () => `repeat(${Math.max(this.proposals().length, 1)}, minmax(0, 1fr))`,
  );

  protected readonly proposalNote = computed(() => {
    const proposal = this.selectedProposal();
    if (!proposal) {
      return '';
    }

    const sameGender = proposal.badges.filter((badge) => badge.type === 'same-gender').length;
    const letter = this.letter(this.selectedIndex());

    return sameGender === 0
      ? `${letter}: todas as duplas mistas e os prioritários na rodada 1.`
      : `${letter}: ${sameGender} ${sameGender === 1 ? 'dupla' : 'duplas'} do mesmo sexo, e os prioritários na rodada 1.`;
  });

  async ngOnInit(): Promise<void> {
    const groupId = this.group.groupId();
    if (groupId) {
      await this.sessionStore.load(groupId);
    }
    await this.regenerate();
  }

  protected async regenerate(): Promise<void> {
    const sessionId = this.sessionId();
    const present = this.sessionStore.present();
    if (present.length === 0) {
      return;
    }

    this.busy.set(true);
    try {
      const [pairs, priorities, draws] = await Promise.all([
        this.draws.getExistingPairsInSession(sessionId),
        this.draws.getPriorityEntries(sessionId),
        this.facade.getDrawsBySessionId(sessionId),
      ]);

      this.existingPairs.set(pairs);
      this.priorityEntries.set(priorities);
      this.drawNumber.set(draws.filter((draw) => draw.selected).length + 1);

      const proposals = await this.draws.generateProposals(sessionId, [...present], pairs, [
        ...priorities,
      ]);

      this.proposals.set(proposals);
      this.selectedIndex.set(0);
      this.swapSelection.set(null);
    } finally {
      this.busy.set(false);
    }
  }

  protected select(index: number): void {
    this.selectedIndex.set(index);
    this.swapSelection.set(null);
  }

  /**
   * Primeiro toque seleciona o chip; o segundo troca os dois de lugar. Tocar no
   * mesmo chip cancela.
   */
  protected tapPlayer(playerId: string): void {
    const selected = this.swapSelection();

    if (!selected) {
      this.swapSelection.set(playerId);
      return;
    }

    if (selected === playerId) {
      this.swapSelection.set(null);
      return;
    }

    const index = this.selectedIndex();
    this.proposals.update((proposals) =>
      proposals.map((proposal, position) =>
        position === index
          ? { ...proposal, teams: this.draws.swapPlayers(proposal.teams, selected, playerId) }
          : proposal,
      ),
    );
    this.swapSelection.set(null);
  }

  protected async useProposal(): Promise<void> {
    const proposal = this.selectedProposal();
    if (!proposal) {
      return;
    }

    // Só a proposta escolhida é gravada como sorteio: as outras não
    // aconteceram, e contá-las inflaria esperas e sorteios (REGRAS.md §7.6).
    const chosen: DrawProposal = { ...proposal, selected: true };
    await this.facade.saveDraw(chosen);

    const session = this.sessionStore.session();
    if (session) {
      await this.facade.updateSession({
        ...session,
        drawIds: [...session.drawIds, chosen.id],
      });
    }

    void this.router.navigate(['/g', this.group.groupId(), 'campeonatos', 'novo'], {
      queryParams: { drawId: chosen.id, proposta: this.letter(this.selectedIndex()) },
    });
  }

  protected letter(index: number): string {
    return ['A', 'B', 'C'][index] ?? String(index + 1);
  }

  protected playerName(playerId: string): string {
    return this.sessionStore.playersById().get(playerId)?.name ?? '?';
  }

  /** A vaga da dupla na chave: as primeiras jogam a rodada 1, a última é bye. */
  private slotLabel(index: number, teamCount: number): string {
    const round1Teams = teamCount >= 5 ? 4 : teamCount === 4 ? 4 : 2;
    if (index >= round1Teams) {
      return 'BYE';
    }
    return `JOGO ${Math.floor(index / 2) + 1}`;
  }

  private reasonLabel(reason: TournamentPriorityEntry['reason']): string {
    switch (reason) {
      case 'direct-elimination':
        return 'Eliminação direta';
      case 'coin-flip-loss':
        return 'Perdeu o par-ou-ímpar';
      case 'waiting-player-not-used':
        return 'Ficou fora do campeonato';
      default:
        return 'Prioridade';
    }
  }

  protected back(): void {
    void this.router.navigate([
      '/g',
      this.group.groupId(),
      'campeonatos',
      'sessoes',
      this.sessionId(),
    ]);
  }
}
