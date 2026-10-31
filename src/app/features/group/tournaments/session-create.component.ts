import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppFacade } from '../../../core/facade/app.facade';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import { SessionStore } from '../../../core/stores/session.store';
import {
  MIN_SUPPORTED_PLAYERS,
  formatsForPlayerCount,
} from '../../../core/rules/tournament-formats';
import { Player } from '../../../shared/models';
import { formatShortDate, todayDateString } from '../../../shared/utils/date.util';
import {
  ActionBarComponent,
  GenderBadgeComponent,
  HeroFieldComponent,
  IconComponent,
  InlineNoteComponent,
  InnerHeaderComponent,
  SectionBandComponent,
} from '../../../shared/ui';

/**
 * Presença na quadra (1e): qualquer jogador marca quem apareceu e o bloco de cima
 * responde na hora — quantas duplas dá, se sobra avulso e quais campeonatos
 * cabem naquele número (REGRAS.md §10).
 */
@Component({
  selector: 'app-session-create',
  imports: [
    ActionBarComponent,
    GenderBadgeComponent,
    HeroFieldComponent,
    IconComponent,
    InlineNoteComponent,
    InnerHeaderComponent,
    SectionBandComponent,
  ],
  template: `
    <app-inner-header
      [context]="context()"
      [title]="editing() ? 'EDITAR PRESENÇA' : 'NOVA SESSÃO'"
      (back)="back()"
    />

    <div class="px-4">
      <label class="relative block">
        <span class="sr-only">Buscar jogador</span>
        <app-icon
          name="search"
          [size]="18"
          class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 muted"
        />
        <input
          class="input pl-10"
          type="search"
          placeholder="Buscar jogador"
          [value]="term()"
          (input)="term.set($any($event.target).value)"
        />
      </label>
    </div>

    <app-hero-field class="mt-4">
      <div class="flex items-end justify-between gap-3">
        <p class="flex items-baseline gap-2">
          <span class="font-heading text-[54px] leading-none font-semibold tnum">{{
            count()
          }}</span>
          <span class="text-[13px] tracking-[0.08em] text-accent-200 uppercase">presentes</span>
        </p>
        <p class="text-right font-heading text-[22px] leading-tight font-semibold uppercase">
          {{ pairCount() }} {{ pairCount() === 1 ? 'dupla' : 'duplas' }}
          @if (hasOddPlayer()) {
            <span class="block text-accent-200">+ 1 avulso</span>
          }
        </p>
      </div>

      @if (pairCount() > 0) {
        <ul class="grid list-none gap-1 p-0" [style.grid-template-columns]="slotColumns()">
          @for (slot of slots(); track slot.label) {
            <li class="flex flex-col items-center gap-1 border border-accent-600 p-1">
              <span class="flex gap-1" aria-hidden="true">
                <span class="size-[10px] bg-accent-300"></span>
                <span
                  class="size-[10px]"
                  [class]="slot.solo ? 'border border-accent-300' : 'bg-accent-300'"
                ></span>
              </span>
              <span class="text-[10px] text-accent-200">{{ slot.label }}</span>
            </li>
          }
        </ul>
      }

      @if (chosen().length > 0) {
        <ul class="flex list-none flex-wrap gap-[6px] p-0">
          @for (player of chosen(); track player.id) {
            <li
              class="inline-flex h-[30px] items-center gap-2 border border-accent-700 px-2 text-[13px]"
            >
              {{ player.name }}
              <app-gender-badge [gender]="player.gender" />
            </li>
          }
        </ul>
      }
    </app-hero-field>

    <div class="px-4 pt-3">
      @if (formatNames().length > 0) {
        <app-inline-note tone="positive">
          Dá para jogar: {{ formatNames().join(' · ') }}
        </app-inline-note>
      } @else if (count() >= minPlayers) {
        <app-inline-note tone="error">
          Nenhum formato para {{ count() }} pessoas — veja as saídas na próxima etapa.
        </app-inline-note>
      } @else {
        <p class="text-[13px] muted">
          Marque pelo menos {{ minPlayers }} pessoas para abrir a sessão.
        </p>
      }
    </div>

    <section class="mt-4">
      <app-section-band [label]="'ATIVOS · ' + activeCount()">
        @if (selected().size > 0) {
          <button type="button" class="text-[13px] text-accent-700" (click)="clear()">
            Limpar
          </button>
        }
      </app-section-band>

      <ul class="list-none p-0">
        @for (player of visibleActive(); track player.id) {
          <li class="row-rule">
            <button
              type="button"
              class="flex h-[50px] w-full items-center gap-3 px-4 text-left"
              [attr.aria-pressed]="selected().has(player.id)"
              (click)="toggle(player.id)"
            >
              <span
                class="flex size-6 shrink-0 items-center justify-center border"
                [class]="
                  selected().has(player.id)
                    ? 'bg-accent-700 border-accent-700 text-bg'
                    : 'border-[1.5px] border-neutral-500'
                "
                aria-hidden="true"
              >
                @if (selected().has(player.id)) {
                  <app-icon name="check" [size]="16" [strokeWidth]="2.25" />
                }
              </span>
              <span
                class="flex-1 text-[16px] font-medium"
                [class.muted]="!selected().has(player.id)"
                >{{ player.name }}</span
              >
              @if (isOwner(player.id)) {
                <span class="tag tag-outline">DONO</span>
              }
              <app-gender-badge [gender]="player.gender" />
            </button>
          </li>
        }
      </ul>

      @if (inactive().length > 0) {
        <button
          type="button"
          class="flex w-full items-center justify-between px-4 py-3 text-[14px] muted"
          [attr.aria-expanded]="showInactive()"
          (click)="showInactive.set(!showInactive())"
        >
          Inativos · {{ inactive().length }}
          <app-icon name="chevron-down" [size]="18" />
        </button>

        @if (showInactive()) {
          <ul class="list-none p-0">
            @for (player of inactive(); track player.id) {
              <li class="row-rule">
                <button
                  type="button"
                  class="flex h-[50px] w-full items-center gap-3 px-4 text-left"
                  [attr.aria-pressed]="selected().has(player.id)"
                  (click)="toggle(player.id)"
                >
                  <span
                    class="flex size-6 shrink-0 items-center justify-center border"
                    [class]="
                      selected().has(player.id)
                        ? 'bg-accent-700 border-accent-700 text-bg'
                        : 'border-[1.5px] border-neutral-500'
                    "
                    aria-hidden="true"
                  >
                    @if (selected().has(player.id)) {
                      <app-icon name="check" [size]="16" [strokeWidth]="2.25" />
                    }
                  </span>
                  <span class="flex-1 text-[16px] font-medium muted">{{ player.name }}</span>
                  <app-gender-badge [gender]="player.gender" />
                </button>
              </li>
            }
          </ul>
        }
      }
    </section>

    <app-action-bar>
      <button
        type="button"
        class="btn btn-primary blueprint h-13 text-[17px]"
        [disabled]="count() < minPlayers"
        (click)="open()"
      >
        <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i>
        <i class="corner br"></i>
        {{ editing() ? 'SALVAR PRESENÇA' : 'ABRIR SESSÃO' }} · {{ count() }}
      </button>
    </app-action-bar>
  `,
  host: { class: 'block' },
})
export class SessionCreateComponent implements OnInit {
  private readonly facade = inject(AppFacade);
  private readonly router = inject(Router);
  private readonly group = inject(CurrentGroupStore);
  private readonly sessionStore = inject(SessionStore);

  /** Vem de `?sessionId=`, quando a tela é aberta para editar a presença. */
  readonly sessionId = input<string | undefined>(undefined);

  protected readonly minPlayers = MIN_SUPPORTED_PLAYERS;
  protected readonly term = signal('');
  protected readonly showInactive = signal(false);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());

  private readonly players = signal<readonly Player[]>([]);

  protected readonly editing = computed(() => !!this.sessionId());
  protected readonly context = computed(
    () => `CAMPEONATOS · ${formatShortDate(todayDateString())}`,
  );

  protected readonly count = computed(() => this.selected().size);
  protected readonly pairCount = computed(() => Math.floor(this.count() / 2));
  protected readonly hasOddPlayer = computed(() => this.count() % 2 !== 0);

  protected readonly chosen = computed(() =>
    this.players().filter((player) => this.selected().has(player.id)),
  );

  protected readonly slots = computed(() => {
    const pairs = Array.from({ length: this.pairCount() }, (_, index) => ({
      label: `D${index + 1}`,
      solo: false,
    }));
    return this.hasOddPlayer() ? [...pairs, { label: 'AVULSO', solo: true }] : pairs;
  });

  protected readonly slotColumns = computed(
    () => `repeat(${Math.max(this.slots().length, 1)}, minmax(0, 1fr))`,
  );

  /** O que dá para jogar com esse número, incluindo deixar o avulso de fora. */
  protected readonly formatNames = computed(() => {
    const count = this.count();
    const names = formatsForPlayerCount(count)
      .filter((format) => format.status === 'available')
      .map((format) => format.name);

    if (this.hasOddPlayer()) {
      names.push(
        ...formatsForPlayerCount(count - 1)
          .filter((format) => format.status === 'available')
          .map((format) => `${format.name} (avulso fora)`),
      );
    }

    return names;
  });

  protected readonly activeCount = computed(
    () => this.players().filter((player) => player.active).length,
  );

  protected readonly visibleActive = computed(() => {
    const term = this.term().trim().toLocaleLowerCase('pt-BR');
    return this.players().filter(
      (player) => player.active && player.name.toLocaleLowerCase('pt-BR').includes(term),
    );
  });

  protected readonly inactive = computed(() => this.players().filter((player) => !player.active));

  async ngOnInit(): Promise<void> {
    const groupId = this.group.groupId();
    if (!groupId) {
      return;
    }

    this.players.set(await this.facade.getPlayersByGroupId(groupId));

    const sessionId = this.sessionId();
    if (sessionId) {
      const session = await this.facade.getSessionById(sessionId);
      this.selected.set(new Set(session?.playerIds ?? []));
      return;
    }

    // Um dia tem uma sessão só: se ela já existe, esta tela edita a presença
    // dela em vez de abrir outra.
    const today = await this.facade.getTodaySession(groupId);
    if (today) {
      this.selected.set(new Set(today.playerIds));
      await this.router.navigate([], {
        queryParams: { sessionId: today.id },
        replaceUrl: true,
      });
    }
  }

  protected isOwner(playerId: string): boolean {
    return this.group.group()?.ownerPlayerId === playerId;
  }

  protected toggle(playerId: string): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  }

  protected clear(): void {
    this.selected.set(new Set());
  }

  protected async open(): Promise<void> {
    const groupId = this.group.groupId();
    if (!groupId || this.count() < this.minPlayers) {
      return;
    }

    const playerIds = [...this.selected()];
    const sessionId = this.sessionId();

    if (sessionId) {
      const session = await this.facade.getSessionById(sessionId);
      if (session) {
        await this.facade.updateSession({ ...session, playerIds });
      }
    } else {
      const created = await this.facade.createSession(groupId, playerIds);
      await this.sessionStore.load(groupId);
      void this.router.navigate(['/g', groupId, 'campeonatos', 'sessoes', created.id]);
      return;
    }

    await this.sessionStore.load(groupId);
    void this.router.navigate(['/g', groupId, 'campeonatos', 'sessoes', sessionId]);
  }

  protected back(): void {
    void this.router.navigate(['/g', this.group.groupId(), 'campeonatos']);
  }
}
