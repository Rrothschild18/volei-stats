import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppFacade } from '../../../core/facade/app.facade';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import { SessionStore } from '../../../core/stores/session.store';
import { TournamentService, randomTournamentName } from '../../../core/services/tournament.service';
import {
  TOURNAMENT_FORMATS,
  formatsForPlayerCount,
  nearestPlayableCounts,
} from '../../../core/rules/tournament-formats';
import { TournamentFormat } from '../../../core/rules/tournament-format.model';
import { DrawProposal, TournamentTeam } from '../../../shared/models';
import {
  ActionBarComponent,
  BlueprintComponent,
  IconComponent,
  InnerHeaderComponent,
  SectionBandComponent,
  StatGridComponent,
  StepperComponent,
  SwitchComponent,
} from '../../../shared/ui';

interface FormatOption {
  readonly id: string;
  readonly format: TournamentFormat;
  /** `false` = o avulso fica fora do campeonato inteiro. */
  readonly usesAvulso: boolean;
  readonly recommended: boolean;
}

interface Suggestion {
  readonly count: number;
  readonly format: TournamentFormat;
  readonly soon: boolean;
  readonly delta: number;
}

/**
 * Formato do campeonato (1i) e a saída quando não existe formato para o número
 * que apareceu (1j).
 *
 * O catálogo (REGRAS.md §10) é que diz o que cabe: o app nunca cria campeonato
 * sem chaveamento, que era como ele travava antes (§7.8).
 */
@Component({
  selector: 'app-tournament-create',
  imports: [
    ActionBarComponent,
    BlueprintComponent,
    IconComponent,
    InnerHeaderComponent,
    SectionBandComponent,
    StatGridComponent,
    StepperComponent,
    SwitchComponent,
  ],
  template: `
    <app-inner-header [context]="context()" title="FORMATO" (back)="back()" />

    <div class="flex flex-col gap-6 px-4 pb-6">
      <section class="flex flex-col gap-3">
        <app-section-band
          index="01"
          [label]="'PARA ' + playerCount() + ' PESSOAS'"
          [meta]="pairsLabel()"
        />

        @if (options().length === 0) {
          <app-blueprint class="flex flex-col gap-2 p-4">
            <app-icon name="triangle-alert" [size]="28" class="text-accent-700" />
            <h2 class="font-heading text-[22px] font-semibold uppercase">
              Nenhum formato para {{ playerCount() }} pessoas
            </h2>
            <p class="text-[14px]">
              O app não cria campeonato sem chave — antes ele travava sem partidas. Escolha uma
              saída:
            </p>
          </app-blueprint>
        }

        @for (option of options(); track option.id) {
          <app-blueprint [selected]="option.id === selectedId()">
            <button
              type="button"
              class="flex w-full flex-col gap-2 p-4 text-left"
              [attr.aria-pressed]="option.id === selectedId()"
              (click)="selectedId.set(option.id)"
            >
              <span class="flex items-center gap-2">
                <span
                  class="size-[18px] shrink-0 rounded-full border-[1.5px]"
                  [class]="
                    option.id === selectedId()
                      ? 'border-accent bg-accent shadow-[inset_0_0_0_4px_var(--color-bg)]'
                      : 'border-neutral-500'
                  "
                  aria-hidden="true"
                ></span>
                <span class="font-heading text-[21px] leading-tight font-semibold uppercase">
                  {{ option.format.name }}
                </span>
                @if (option.recommended) {
                  <span class="tag tag-accent">RECOMENDADO</span>
                }
              </span>

              <span class="text-[14px] text-neutral-800">{{ option.format.summary }}</span>

              @if (!option.usesAvulso && waitingPlayerName()) {
                <span class="text-[13px] text-accent-700">
                  {{ waitingPlayerName() }} fica fora do campeonato inteiro e ganha prioridade no
                  próximo sorteio.
                </span>
              }

              <app-stat-grid class="w-full" [columns]="4" [items]="formatStats(option.format)" />
            </button>
          </app-blueprint>
        }

        @for (suggestion of suggestions(); track suggestion.format.id) {
          <div
            class="flex flex-col gap-1 border border-dashed border-neutral-500 p-4"
            [class.muted]="suggestion.soon"
          >
            <span class="flex items-center gap-2 kicker">
              <app-icon name="user-plus" [size]="16" />
              COM {{ suggestion.count }} PESSOAS
              @if (suggestion.soon) {
                <span class="tag tag-neutral">EM BREVE</span>
              }
            </span>
            <span class="font-heading text-[19px] font-semibold uppercase">{{
              suggestion.format.name
            }}</span>
            <span class="text-[13px] muted">
              @if (!suggestion.soon) {
                {{
                  suggestion.delta > 0 ? 'Chame ' + suggestion.delta : 'Tire ' + -suggestion.delta
                }}
                ·
              }
              {{ suggestion.format.matchCount }} partidas ·
              {{ suggestion.format.recommendedCourts }}
              {{ suggestion.format.recommendedCourts === 1 ? 'quadra' : 'quadras' }}
            </span>
            @if (!suggestion.soon) {
              <button
                type="button"
                class="btn btn-secondary mt-2 self-start px-3 text-[13px]"
                (click)="adjustPresence()"
              >
                AJUSTAR PRESENÇA
              </button>
            }
          </div>
        }
      </section>

      @if (selectedFormat(); as format) {
        <section class="flex flex-col gap-4">
          <app-section-band index="02" label="REGRAS DESTE CAMPEONATO" />

          <div class="flex items-center gap-3">
            <span class="flex-1">
              <span class="block font-heading text-[17px] font-semibold uppercase"
                >Limite de pontos</span
              >
              <span class="block text-[13px] muted">Acima dele, o placar é só aviso</span>
            </span>
            <app-stepper label="limite de pontos" [(value)]="pointLimit" [min]="1" />
          </div>

          @if (format.thirdPlace === 'optional') {
            <div class="flex items-center gap-3 border-t border-divider pt-4">
              <span class="flex-1">
                <span class="block font-heading text-[17px] font-semibold uppercase"
                  >Disputa de 3º lugar</span
                >
                <span class="block text-[13px] muted">
                  {{
                    format.thirdPlaceDefault
                      ? 'Ligada por padrão neste formato'
                      : 'Desligada por padrão neste formato'
                  }}
                </span>
              </span>
              <app-switch label="Disputa de 3º lugar" [(checked)]="thirdPlace" />
            </div>
          }

          @if (selectedOption()?.usesAvulso) {
            <div class="flex items-center gap-3 border-t border-divider pt-4">
              <span class="flex-1">
                <span class="block font-heading text-[17px] font-semibold uppercase">
                  Prioridade a quem perder o par-ou-ímpar
                </span>
                <span class="block text-[13px] muted">Entra na rodada 1 do próximo sorteio</span>
              </span>
              <app-switch
                label="Prioridade a quem perde o par-ou-ímpar"
                [(checked)]="loserPriority"
              />
            </div>
          }

          <div class="flex items-center gap-3 border-t border-divider pt-4">
            <span class="flex-1">
              <span class="block text-[13px] muted">Nome sorteado</span>
              <span class="block font-heading text-[19px] font-semibold uppercase">{{
                name()
              }}</span>
            </span>
            <button
              type="button"
              class="btn btn-secondary btn-icon"
              aria-label="Sortear outro nome"
              (click)="rerollName()"
            >
              <app-icon name="dices" [size]="20" />
            </button>
          </div>
        </section>
      }
    </div>

    <app-action-bar>
      <button
        type="button"
        class="btn btn-primary blueprint h-13 text-[17px]"
        [disabled]="!selectedFormat() || busy()"
        (click)="start()"
      >
        <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i>
        <i class="corner br"></i>
        INICIAR CAMPEONATO
      </button>
    </app-action-bar>
  `,
  host: { class: 'block' },
})
export class TournamentCreateComponent implements OnInit {
  private readonly facade = inject(AppFacade);
  private readonly tournaments = inject(TournamentService);
  private readonly router = inject(Router);
  private readonly group = inject(CurrentGroupStore);
  private readonly sessionStore = inject(SessionStore);

  /** `?drawId=` da proposta escolhida no sorteio. */
  readonly drawId = input.required<string>();
  /** `?proposta=` a letra da proposta, só para o kicker. */
  readonly proposta = input<string | undefined>(undefined);

  private readonly draw = signal<DrawProposal | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly pointLimit = signal(12);
  protected readonly thirdPlace = signal(false);
  protected readonly loserPriority = signal(true);
  protected readonly name = signal(randomTournamentName());
  protected readonly busy = signal(false);

  protected readonly context = computed(() => {
    const letter = this.proposta();
    return letter ? `NOVO CAMPEONATO · PROPOSTA ${letter}` : 'NOVO CAMPEONATO';
  });

  /** Pessoas no sorteio, contando o avulso. */
  protected readonly playerCount = computed(() => {
    const draw = this.draw();
    if (!draw) {
      return 0;
    }
    return draw.teams.length * 2 + (draw.waitingPlayerId ? 1 : 0);
  });

  protected readonly waitingPlayerName = computed(() => {
    const waitingPlayerId = this.draw()?.waitingPlayerId;
    return waitingPlayerId
      ? (this.sessionStore.playersById().get(waitingPlayerId)?.name ?? null)
      : null;
  });

  protected readonly pairsLabel = computed(() => {
    const draw = this.draw();
    if (!draw) {
      return null;
    }
    const pairs = `${draw.teams.length} duplas`;
    return this.waitingPlayerName() ? `${pairs} + ${this.waitingPlayerName()}` : pairs;
  });

  /**
   * Os formatos que cabem: os do número cheio e, quando sobra alguém, os de uma
   * pessoa menos — com o avulso fora do campeonato.
   */
  protected readonly options = computed<FormatOption[]>(() => {
    const count = this.playerCount();
    if (count === 0) {
      return [];
    }

    const withAvulso = formatsForPlayerCount(count)
      .filter((format) => format.status === 'available')
      .map((format) => ({ id: format.id, format, usesAvulso: true, recommended: false }));

    const withoutAvulso = this.draw()?.waitingPlayerId
      ? formatsForPlayerCount(count - 1)
          .filter((format) => format.status === 'available')
          .map((format) => ({
            id: `${format.id}:sem-avulso`,
            format,
            usesAvulso: false,
            recommended: false,
          }))
      : [];

    const all = [...withAvulso, ...withoutAvulso];
    return all.map((option, index) => ({ ...option, recommended: index === 0 }));
  });

  protected readonly selectedOption = computed(
    () => this.options().find((option) => option.id === this.selectedId()) ?? null,
  );

  protected readonly selectedFormat = computed(() => this.selectedOption()?.format ?? null);

  /** Números próximos que dariam campeonato, e os formatos ainda planejados. */
  protected readonly suggestions = computed<Suggestion[]>(() => {
    const count = this.playerCount();
    if (count === 0) {
      return [];
    }

    const planned = TOURNAMENT_FORMATS.filter(
      (format) => format.status === 'planned' && format.playerCount === count,
    ).map((format) => ({ count, format, soon: true, delta: 0 }));

    if (this.options().length > 0) {
      return planned;
    }

    const nearest = nearestPlayableCounts(count)
      .flatMap((candidate) =>
        formatsForPlayerCount(candidate)
          .filter((format) => format.status === 'available')
          .slice(0, 1)
          .map((format) => ({
            count: candidate,
            format,
            soon: false,
            delta: candidate - count,
          })),
      )
      .slice(0, 1);

    return [...nearest, ...planned];
  });

  async ngOnInit(): Promise<void> {
    const groupId = this.group.groupId();
    if (groupId) {
      await this.sessionStore.load(groupId);
    }

    const draw = await this.facade.getDrawById(this.drawId());
    this.draw.set(draw ?? null);

    const first = this.options()[0];
    if (first) {
      this.selectedId.set(first.id);
      this.thirdPlace.set(first.format.thirdPlaceDefault);
    }
  }

  protected formatStats(format: TournamentFormat) {
    return [
      { value: format.matchCount, label: 'partidas' },
      {
        value: format.recommendedCourts,
        label: format.recommendedCourts === 1 ? 'quadra' : 'quadras',
      },
      { value: `${format.minGamesPerTeam}×`, label: 'mín./dupla' },
      {
        value: format.thirdPlace === 'optional' ? '3º' : '—',
        label: format.thirdPlace === 'optional' ? 'opcional' : 'sem 3º',
      },
    ];
  }

  protected rerollName(): void {
    this.name.set(randomTournamentName());
  }

  protected async start(): Promise<void> {
    const draw = this.draw();
    const option = this.selectedOption();
    const session = this.sessionStore.session();
    if (!draw || !option || !session || this.busy()) {
      return;
    }

    this.busy.set(true);
    try {
      const teams: TournamentTeam[] = draw.teams.map((team) => ({
        id: team.id,
        playerIds: team.playerIds,
        eliminated: false,
        eliminatedDirectly: false,
        synthetic: false,
        originalPlayerIds: null,
      }));

      const tournament = await this.tournaments.createTournament({
        sessionId: session.id,
        drawId: draw.id,
        formatId: option.format.id,
        name: this.name(),
        teams,
        pointLimit: this.pointLimit(),
        thirdPlaceEnabled: option.format.thirdPlace === 'optional' ? this.thirdPlace() : false,
        waitingPlayerId: draw.waitingPlayerId,
        // Com o avulso fora, não há encaixe: ele ganha prioridade no próximo
        // sorteio e fica de fora do campeonato inteiro.
        oddPlayerPlacementEnabled: option.usesAvulso && !!draw.waitingPlayerId,
        oddPlayerLoserPriorityEnabled: this.loserPriority(),
      });

      await this.facade.updateSession({
        ...session,
        tournamentIds: [...session.tournamentIds, tournament.id],
      });

      void this.router.navigate(['/g', this.group.groupId(), 'campeonatos', tournament.id]);
    } finally {
      this.busy.set(false);
    }
  }

  protected adjustPresence(): void {
    const session = this.sessionStore.session();
    void this.router.navigate(['/g', this.group.groupId(), 'campeonatos', 'sessoes', 'nova'], {
      queryParams: session ? { sessionId: session.id } : {},
    });
  }

  protected back(): void {
    const session = this.sessionStore.session();
    void this.router.navigate(
      session
        ? ['/g', this.group.groupId(), 'campeonatos', 'sessoes', session.id, 'sorteio']
        : ['/g', this.group.groupId(), 'campeonatos'],
    );
  }
}
