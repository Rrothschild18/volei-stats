import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppFacade } from '../../../core/facade/app.facade';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import { StatisticsService } from '../../../core/services/statistics.service';
import { Player, PlayerStats } from '../../../shared/models';
import { formatShortDate, todayDateString } from '../../../shared/utils/date.util';
import {
  ActionBarComponent,
  GenderBadgeComponent,
  IconComponent,
  RoleTagComponent,
  RootHeaderComponent,
  SegmentedComponent,
} from '../../../shared/ui';

type Filter = 'active' | 'inactive' | 'all';

/** Jogadores do grupo, com o aproveitamento de cada um (1x). */
@Component({
  selector: 'app-player-list',
  imports: [
    ActionBarComponent,
    GenderBadgeComponent,
    IconComponent,
    RoleTagComponent,
    RootHeaderComponent,
    SegmentedComponent,
  ],
  template: `
    <app-root-header [context]="context()" title="JOGADORES" (switchGroup)="toGroups()">
      <app-role-tag slot="role" [isOwner]="group.isOwner()" [playerName]="group.me()?.name ?? null" />
    </app-root-header>

    <div class="px-4 pt-4">
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

    <app-segmented
      class="mt-4"
      [options]="filters()"
      [value]="filter()"
      (valueChange)="filter.set($any($event))"
      [tabs]="false"
    />

    <ul class="mt-2 list-none p-0">
      @for (entry of visible(); track entry.player.id) {
        <li class="row-rule">
          <button
            type="button"
            class="flex h-14 w-full items-center gap-3 px-4 text-left"
            (click)="open(entry.player)"
          >
            <span
              class="flex size-9 shrink-0 items-center justify-center border border-divider font-heading text-[16px] font-semibold"
              aria-hidden="true"
              >{{ entry.player.name.charAt(0).toUpperCase() }}</span
            >
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2">
                <span
                  class="truncate font-heading text-[18px] leading-tight font-semibold uppercase"
                  [class.muted]="!entry.player.active"
                  >{{ entry.player.name }}</span
                >
                <app-gender-badge [gender]="entry.player.gender" />
                @if (entry.isOwner) {
                  <span class="tag tag-outline">DONO</span>
                }
              </span>
              @if (!entry.player.active) {
                <span class="text-[12px] muted">Inativo · fora da lista de presença</span>
              }
            </span>
            <span class="text-[13px] tnum muted">
              {{ entry.stats.gamesPlayed }} J · {{ entry.stats.winPercentage }}%
            </span>
            <app-icon name="chevron-right" [size]="18" class="muted" />
          </button>
        </li>
      } @empty {
        <li class="px-4 py-6 text-[14px] muted">Ninguém encontrado com esse nome.</li>
      }
    </ul>

    @if (group.isOwner()) {
      <app-action-bar [withTabBar]="true">
        <button type="button" class="btn btn-primary blueprint h-13" (click)="create()">
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i>
          <i class="corner br"></i>
          <app-icon name="user-plus" [size]="20" />
          NOVO JOGADOR
        </button>
      </app-action-bar>
    }
  `,
  host: { class: 'block' },
})
export class PlayerListComponent implements OnInit {
  private readonly facade = inject(AppFacade);
  private readonly stats = inject(StatisticsService);
  private readonly router = inject(Router);
  protected readonly group = inject(CurrentGroupStore);

  private readonly players = signal<readonly Player[]>([]);
  private readonly playerStats = signal<readonly PlayerStats[]>([]);

  protected readonly term = signal('');
  protected readonly filter = signal<Filter>('active');

  protected readonly context = computed(
    () =>
      `${this.group.group()?.name?.toUpperCase() ?? ''} · ${formatShortDate(todayDateString())}`,
  );

  private readonly entries = computed(() => {
    const ownerId = this.group.group()?.ownerPlayerId ?? null;
    const statsById = new Map(this.playerStats().map((entry) => [entry.playerId, entry]));

    return this.players().map((player) => ({
      player,
      isOwner: player.id === ownerId,
      stats:
        statsById.get(player.id) ??
        ({
          playerId: player.id,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          timesWaited: 0,
          winPercentage: 0,
        } satisfies PlayerStats),
    }));
  });

  protected readonly filters = computed(() => {
    const all = this.entries();
    const active = all.filter((entry) => entry.player.active).length;
    return [
      { id: 'active', label: `Ativos · ${active}` },
      { id: 'inactive', label: `Inativos · ${all.length - active}` },
      { id: 'all', label: 'Todos' },
    ];
  });

  protected readonly visible = computed(() => {
    const term = this.term().trim().toLocaleLowerCase('pt-BR');
    const filter = this.filter();

    return this.entries()
      .filter((entry) => {
        if (filter === 'active' && !entry.player.active) return false;
        if (filter === 'inactive' && entry.player.active) return false;
        return entry.player.name.toLocaleLowerCase('pt-BR').includes(term);
      })
      .sort((a, b) => a.player.name.localeCompare(b.player.name, 'pt-BR'));
  });

  async ngOnInit(): Promise<void> {
    const groupId = this.group.groupId();
    if (!groupId) {
      return;
    }

    const scope = await this.facade.getGroupScope(groupId);
    const [players, stats] = await Promise.all([
      this.facade.getPlayersByGroupId(groupId),
      this.stats.getAllPlayerStats({ includeWithoutGames: true, scope }),
    ]);

    this.players.set(players);
    this.playerStats.set(stats);
  }

  protected open(player: Player): void {
    void this.router.navigate(['/g', this.group.groupId(), 'jogadores', player.id]);
  }

  protected create(): void {
    void this.router.navigate(['/g', this.group.groupId(), 'jogadores', 'novo']);
  }

  protected toGroups(): void {
    void this.router.navigate(['/voleis']);
  }
}
