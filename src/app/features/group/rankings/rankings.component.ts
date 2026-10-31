import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppFacade } from '../../../core/facade/app.facade';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import { StatisticsService } from '../../../core/services/statistics.service';
import { phaseLabel } from '../../../core/rules/bracket-phases';
import { Match, Player, PlayerStats, Session, TeamStats, Tournament } from '../../../shared/models';
import {
  daysBetween,
  formatShortDate,
  formatTime,
  todayDateString,
} from '../../../shared/utils/date.util';
import {
  IconComponent,
  RoleTagComponent,
  RootHeaderComponent,
  SectionBandComponent,
  SegmentedComponent,
} from '../../../shared/ui';

type Tab = 'individual' | 'teams' | 'matches';
type Period = 'today' | '7' | '30' | 'all';

interface MatchRow {
  readonly id: string;
  readonly time: string;
  readonly phase: string;
  readonly teamA: string;
  readonly teamB: string;
  readonly scoreA: number;
  readonly scoreB: number;
  readonly winnerIsA: boolean;
}

interface MatchGroup {
  readonly key: string;
  readonly label: string;
  readonly rows: readonly MatchRow[];
}

/**
 * Rankings do grupo (1v) e o histórico de partidas (1w), que antes era uma tela
 * solta. As tabelas cabem na largura do celular: nada de rolagem lateral.
 */
@Component({
  selector: 'app-rankings',
  imports: [
    IconComponent,
    RoleTagComponent,
    RootHeaderComponent,
    SectionBandComponent,
    SegmentedComponent,
  ],
  template: `
    <app-root-header [context]="context()" title="RANKINGS" (switchGroup)="toGroups()">
      <app-role-tag slot="role" [role]="group.role()" [playerName]="group.me()?.name ?? null" />
    </app-root-header>

    <app-segmented
      [options]="tabs"
      [value]="tab()"
      (valueChange)="tab.set($any($event))"
      role="tablist"
    />

    @switch (tab()) {
      @case ('individual') {
        <table class="w-full border-collapse">
          <caption class="sr-only">
            Ranking individual do grupo
          </caption>
          <thead>
            <tr class="bg-accent-100 text-[11px] tracking-[0.06em] uppercase">
              <th class="w-7 py-2 pl-4 text-left font-semibold">Nº</th>
              <th class="py-2 text-left font-semibold">Jogador</th>
              <th class="w-8 py-2 text-right font-semibold">J</th>
              <th class="w-8 py-2 text-right font-semibold">V</th>
              <th class="w-11 py-2 text-right font-semibold text-accent-700">%</th>
              <th class="w-9 py-2 pr-4 text-right font-semibold">Esp</th>
            </tr>
          </thead>
          <tbody>
            @for (row of individual(); track row.stats.playerId; let index = $index) {
              <tr class="row-rule h-11" [class.bg-accent-100]="row.isMe">
                <td class="pl-4 text-[13px] tnum muted">{{ index + 1 }}</td>
                <td class="font-heading text-[17px] font-semibold uppercase">{{ row.name }}</td>
                <td class="text-right text-[14px] tnum">{{ row.stats.gamesPlayed }}</td>
                <td class="text-right text-[14px] tnum">{{ row.stats.wins }}</td>
                <td class="text-right font-heading text-[19px] font-semibold tnum">
                  {{ row.stats.winPercentage }}
                </td>
                <td class="pr-4 text-right text-[14px] tnum muted">{{ row.stats.timesWaited }}</td>
              </tr>
            }
          </tbody>
        </table>
        <p class="px-4 py-3 text-[12px] muted">
          Ordem por aproveitamento. Esp = vezes que esperou, contando só o sorteio escolhido. Só
          aparece quem já jogou.
        </p>
      }

      @case ('teams') {
        <table class="w-full border-collapse">
          <caption class="sr-only">
            Ranking de duplas do grupo
          </caption>
          <thead>
            <tr class="bg-accent-100 text-[11px] tracking-[0.06em] uppercase">
              <th class="w-7 py-2 pl-4 text-left font-semibold">Nº</th>
              <th class="py-2 text-left font-semibold">Dupla</th>
              <th class="w-8 py-2 text-right font-semibold">J</th>
              <th class="w-8 py-2 text-right font-semibold">V</th>
              <th class="w-11 py-2 pr-4 text-right font-semibold text-accent-700">%</th>
            </tr>
          </thead>
          <tbody>
            @for (row of teams(); track row.key; let index = $index) {
              <tr class="row-rule h-11" [class.bg-accent-100]="row.isMine">
                <td class="pl-4 text-[13px] tnum muted">{{ index + 1 }}</td>
                <td class="font-heading text-[17px] font-semibold uppercase">{{ row.label }}</td>
                <td class="text-right text-[14px] tnum">{{ row.stats.gamesPlayed }}</td>
                <td class="text-right text-[14px] tnum">{{ row.stats.wins }}</td>
                <td class="pr-4 text-right font-heading text-[19px] font-semibold tnum">
                  {{ row.stats.winPercentage }}
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="px-4 py-6 text-[14px] muted">
                  Nenhuma dupla com 3 jogos juntos ainda.
                </td>
              </tr>
            }
          </tbody>
        </table>
        <p class="px-4 py-3 text-[12px] muted">
          Só duplas com 3 jogos juntos ou mais — abaixo disso, o aproveitamento é sorte.
        </p>
      }

      @case ('matches') {
        <div class="flex flex-col gap-3 px-4 pt-4">
          <app-segmented
            [options]="periods"
            [value]="period()"
            (valueChange)="period.set($any($event))"
            [tabs]="false"
          />
          <button
            type="button"
            class="btn btn-secondary justify-between normal-case"
            (click)="cyclePlayer()"
          >
            <span class="flex items-center gap-2">
              <app-icon name="user-round" [size]="16" />
              {{ playerFilterLabel() }}
            </span>
            <app-icon name="chevron-down" [size]="16" />
          </button>
        </div>

        @for (entry of matchGroups(); track entry.key) {
          <section class="mt-4">
            <app-section-band [label]="entry.label" />
            @for (row of entry.rows; track row.id) {
              <div class="row-rule px-4 py-[11px]">
                <p class="text-[11px] tracking-[0.06em] uppercase muted">
                  {{ row.time }} · {{ row.phase }}
                </p>
                <p class="mt-1 flex items-baseline gap-2">
                  <span
                    class="flex-1 font-heading text-[17px] uppercase"
                    [class.font-semibold]="row.winnerIsA"
                    [class.muted]="!row.winnerIsA"
                    >{{ row.teamA }}</span
                  >
                  <span class="font-heading text-[19px] font-semibold tnum"
                    >{{ row.scoreA }} × {{ row.scoreB }}</span
                  >
                  <span
                    class="flex-1 text-right font-heading text-[17px] uppercase"
                    [class.font-semibold]="!row.winnerIsA"
                    [class.muted]="row.winnerIsA"
                    >{{ row.teamB }}</span
                  >
                </p>
              </div>
            }
          </section>
        } @empty {
          <p class="px-4 py-6 text-[14px] muted">Nenhuma partida nesse período.</p>
        }
      }
    }
  `,
  host: { class: 'block pb-8' },
})
export class RankingsComponent implements OnInit {
  private readonly facade = inject(AppFacade);
  private readonly statistics = inject(StatisticsService);
  private readonly router = inject(Router);
  protected readonly group = inject(CurrentGroupStore);

  protected readonly tab = signal<Tab>('individual');
  protected readonly period = signal<Period>('today');
  protected readonly playerFilter = signal<string | null>(null);

  protected readonly tabs = [
    { id: 'individual', label: 'Individual' },
    { id: 'teams', label: 'Duplas' },
    { id: 'matches', label: 'Partidas' },
  ];

  protected readonly periods = [
    { id: 'today', label: 'Hoje' },
    { id: '7', label: '7 dias' },
    { id: '30', label: '30 dias' },
    { id: 'all', label: 'Tudo' },
  ];

  private readonly players = signal<readonly Player[]>([]);
  private readonly groupPlayerIds = signal<ReadonlySet<string>>(new Set());
  private readonly playerStats = signal<readonly PlayerStats[]>([]);
  private readonly teamStats = signal<readonly TeamStats[]>([]);
  private readonly sessions = signal<readonly Session[]>([]);
  private readonly tournaments = signal<readonly Tournament[]>([]);
  private readonly matches = signal<readonly Match[]>([]);

  protected readonly context = computed(
    () =>
      `${this.group.group()?.name?.toUpperCase() ?? ''} · ${formatShortDate(todayDateString())}`,
  );

  private readonly namesById = computed(
    () => new Map(this.players().map((player) => [player.id, player.name])),
  );

  protected readonly individual = computed(() => {
    const names = this.namesById();
    const inGroup = this.groupPlayerIds();
    const me = this.group.playerId();

    return this.playerStats()
      .filter((stats) => inGroup.has(stats.playerId))
      .sort((a, b) => b.winPercentage - a.winPercentage || b.wins - a.wins)
      .map((stats) => ({
        stats,
        name: names.get(stats.playerId) ?? '?',
        isMe: stats.playerId === me,
      }));
  });

  protected readonly teams = computed(() => {
    const inGroup = this.groupPlayerIds();
    const me = this.group.playerId();

    return this.teamStats()
      .filter((stats) => stats.gamesPlayed >= 3 && stats.playerIds.every((id) => inGroup.has(id)))
      .sort((a, b) => b.winPercentage - a.winPercentage || b.gamesPlayed - a.gamesPlayed)
      .map((stats) => ({
        key: [...stats.playerIds].sort().join('|'),
        label: stats.playerNames.join(' + '),
        stats,
        isMine: stats.playerIds.includes(me),
      }));
  });

  protected readonly playerFilterLabel = computed(() => {
    const filter = this.playerFilter();
    return filter ? (this.namesById().get(filter) ?? 'Todos') : 'Todos';
  });

  /** Partidas do grupo, agrupadas por campeonato, respeitando os filtros. */
  protected readonly matchGroups = computed<MatchGroup[]>(() => {
    const sessionById = new Map(this.sessions().map((session) => [session.id, session]));
    const tournamentById = new Map(
      this.tournaments().map((tournament) => [tournament.id, tournament]),
    );
    const teamsById = new Map<string, readonly string[]>();
    for (const tournament of this.tournaments()) {
      for (const team of tournament.teams) {
        teamsById.set(team.id, team.playerIds);
      }
    }

    const names = this.namesById();
    const label = (teamId: string) =>
      (teamsById.get(teamId) ?? [])
        .map((id) => names.get(id) ?? '?')
        .join(' + ')
        .toUpperCase();

    const filter = this.playerFilter();
    const today = todayDateString();
    const limit =
      this.period() === 'all' ? null : this.period() === 'today' ? 0 : Number(this.period());

    const groups = new Map<string, { label: string; rows: MatchRow[] }>();

    for (const match of this.matches()) {
      if (!match.winnerId) {
        continue;
      }

      const session = sessionById.get(match.sessionId);
      const tournament = tournamentById.get(match.tournamentId);
      if (!session || !tournament) {
        continue;
      }

      if (limit !== null && daysBetween(session.date, today) > limit) {
        continue;
      }

      if (
        filter &&
        ![match.teamAId, match.teamBId].some((teamId) => teamsById.get(teamId)?.includes(filter))
      ) {
        continue;
      }

      const key = tournament.id;
      let entry = groups.get(key);
      if (!entry) {
        const dayLabel =
          session.date === today ? 'HOJE' : formatShortDate(session.date).toUpperCase();
        entry = { label: `${dayLabel} · ${tournament.name.toUpperCase()}`, rows: [] };
        groups.set(key, entry);
      }

      entry.rows.push({
        id: match.id,
        time: formatTime(match.playedAt),
        phase: phaseLabel(match.phase),
        teamA: label(match.teamAId),
        teamB: label(match.teamBId),
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        winnerIsA: match.winnerId === match.teamAId,
      });
    }

    return [...groups.entries()]
      .map(([key, entry]) => ({
        key,
        label: entry.label,
        rows: entry.rows.sort((a, b) => a.time.localeCompare(b.time)),
      }))
      .sort((a, b) => b.rows[0].time.localeCompare(a.rows[0].time));
  });

  async ngOnInit(): Promise<void> {
    const groupId = this.group.groupId();
    if (!groupId) {
      return;
    }

    const scope = await this.facade.getGroupScope(groupId);
    const [players, groupPlayers, playerStats, teamStats, sessions] = await Promise.all([
      this.facade.getPlayers(),
      this.facade.getPlayersByGroupId(groupId),
      this.statistics.getAllPlayerStats({ scope }),
      this.statistics.getTeamStats(scope),
      this.facade.getSessionsByGroupId(groupId),
    ]);

    this.players.set(players);
    this.groupPlayerIds.set(new Set(groupPlayers.map((player) => player.id)));
    this.playerStats.set(playerStats);
    this.teamStats.set(teamStats);
    this.sessions.set(sessions);

    const sessionIds = new Set(sessions.map((session) => session.id));
    const [tournaments, matches] = await Promise.all([
      this.facade.getTournaments(),
      this.facade.getMatches(),
    ]);

    this.tournaments.set(tournaments.filter((tournament) => sessionIds.has(tournament.sessionId)));
    this.matches.set(matches.filter((match) => sessionIds.has(match.sessionId)));
  }

  /** Filtro de jogador simples: percorre quem jogou, começando por "Todos". */
  protected cyclePlayer(): void {
    const ids = this.individual().map((row) => row.stats.playerId);
    const current = this.playerFilter();
    const index = current ? ids.indexOf(current) : -1;
    this.playerFilter.set(index + 1 >= ids.length ? null : ids[index + 1]);
  }

  protected toGroups(): void {
    void this.router.navigate(['/voleis']);
  }
}
