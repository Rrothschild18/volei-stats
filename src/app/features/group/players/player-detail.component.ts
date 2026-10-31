import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppFacade } from '../../../core/facade/app.facade';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import { StatisticsService } from '../../../core/services/statistics.service';
import { phaseLabel } from '../../../core/rules/bracket-phases';
import { Match, Player, PlayerStats, TeamStats, Tournament } from '../../../shared/models';
import { formatDayMonthFromIso, formatTime } from '../../../shared/utils/date.util';
import {
  BlueprintComponent,
  IconComponent,
  InnerHeaderComponent,
  SectionBandComponent,
} from '../../../shared/ui';

interface RecentMatch {
  readonly id: string;
  readonly when: string;
  readonly phase: string;
  readonly mine: string;
  readonly theirs: string;
  readonly myScore: number;
  readonly theirScore: number;
  readonly won: boolean;
}

/** Perfil do jogador: os números dele, os parceiros e as últimas partidas (1z). */
@Component({
  selector: 'app-player-detail',
  imports: [BlueprintComponent, IconComponent, InnerHeaderComponent, SectionBandComponent],
  template: `
    <app-inner-header context="JOGADORES" [title]="player()?.name ?? ''" (back)="back()">
      @if (group.isOwner()) {
        <button
          type="button"
          class="btn btn-ghost btn-icon border-0"
          aria-label="Editar jogador"
          (click)="edit()"
        >
          <app-icon name="square-pen" [size]="22" />
        </button>
      }
    </app-inner-header>

    <div class="flex flex-col gap-5 px-4 pb-8">
      <app-blueprint>
        <div class="grid grid-cols-3">
          @for (stat of stats(); track stat.label) {
            <div
              class="px-3 py-3 not-nth-[3n+1]:border-l border-divider not-first:border-t-0 [&:nth-child(n+4)]:border-t"
            >
              <p class="figure">{{ stat.value }}</p>
              <p class="text-[12px] muted">{{ stat.label }}</p>
            </div>
          }
        </div>
      </app-blueprint>

      <section>
        <app-section-band index="01" label="PARCEIROS FREQUENTES" />
        <app-blueprint>
          @for (partner of partners(); track partner.name; let last = $last) {
            <div class="flex items-center gap-3 px-[14px] py-[11px]" [class.row-rule]="!last">
              <span class="flex-1 font-heading text-[17px] font-semibold uppercase">{{
                partner.name
              }}</span>
              <span class="text-[13px] muted">{{ partner.games }} jogos</span>
              <span class="font-heading text-[19px] font-semibold tnum">{{ partner.pct }}%</span>
            </div>
          } @empty {
            <p class="px-[14px] py-3 text-[13px] muted">Ainda sem dupla com 2 jogos ou mais.</p>
          }
        </app-blueprint>
      </section>

      <section>
        <app-section-band index="02" label="ÚLTIMAS PARTIDAS" />
        <app-blueprint>
          @for (match of recent(); track match.id; let last = $last) {
            <div class="flex items-center gap-3 px-[14px] py-[11px]" [class.row-rule]="!last">
              <span class="min-w-0 flex-1">
                <span class="block text-[11px] tracking-[0.06em] uppercase muted"
                  >{{ match.when }} · {{ match.phase }}</span
                >
                <span class="block truncate font-heading text-[16px] font-semibold uppercase">
                  {{ match.mine }} {{ match.myScore }} × {{ match.theirScore }} {{ match.theirs }}
                </span>
              </span>
              <span
                class="flex size-7 shrink-0 items-center justify-center border font-heading text-[14px] font-semibold"
                [class]="
                  match.won ? 'border-accent text-accent-800 bg-accent-100' : 'border-divider muted'
                "
                >{{ match.won ? 'V' : 'D' }}</span
              >
            </div>
          } @empty {
            <p class="px-[14px] py-3 text-[13px] muted">Ainda não jogou nenhuma partida.</p>
          }
        </app-blueprint>
      </section>
    </div>
  `,
  host: { class: 'block' },
})
export class PlayerDetailComponent implements OnInit {
  private readonly facade = inject(AppFacade);
  private readonly statistics = inject(StatisticsService);
  private readonly router = inject(Router);
  protected readonly group = inject(CurrentGroupStore);

  /** Vem da rota, por `withComponentInputBinding`. */
  readonly playerId = input.required<string>();

  protected readonly player = signal<Player | null>(null);
  private readonly allPlayers = signal<readonly Player[]>([]);
  private readonly playerStats = signal<PlayerStats | null>(null);
  private readonly teamStats = signal<readonly TeamStats[]>([]);
  private readonly ranking = signal<number | null>(null);
  protected readonly recent = signal<readonly RecentMatch[]>([]);

  protected readonly stats = computed(() => {
    const entry = this.playerStats();
    const position = this.ranking();
    return [
      { value: entry?.gamesPlayed ?? 0, label: 'jogos' },
      { value: entry?.wins ?? 0, label: 'vitórias' },
      { value: entry?.losses ?? 0, label: 'derrotas' },
      { value: `${entry?.winPercentage ?? 0}%`, label: 'aproveitamento' },
      { value: position ? `${position}º` : '—', label: 'no ranking' },
      { value: entry?.timesWaited ?? 0, label: entry?.timesWaited === 1 ? 'espera' : 'esperas' },
    ];
  });

  protected readonly partners = computed(() => {
    const playerId = this.playerId();
    return this.teamStats()
      .filter((entry) => entry.playerIds.includes(playerId) && entry.gamesPlayed >= 2)
      .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
      .slice(0, 5)
      .map((entry) => {
        const index = entry.playerIds.indexOf(playerId);
        return {
          name: entry.playerNames[index === 0 ? 1 : 0],
          games: entry.gamesPlayed,
          pct: entry.winPercentage,
        };
      });
  });

  async ngOnInit(): Promise<void> {
    const playerId = this.playerId();
    const scope = await this.facade.getGroupScope(this.group.groupId() ?? '');
    const [player, allPlayers, allStats, teamStats, matches, tournaments] = await Promise.all([
      this.facade.getPlayerById(playerId),
      this.facade.getPlayers(),
      this.statistics.getAllPlayerStats({ scope }),
      this.statistics.getTeamStats(scope),
      this.statistics.getMatchesForPlayer(playerId, scope),
      this.facade.getTournaments(),
    ]);

    this.player.set(player ?? null);
    this.allPlayers.set(allPlayers);
    this.playerStats.set(allStats.find((entry) => entry.playerId === playerId) ?? null);
    this.teamStats.set(teamStats);

    // O ranking é do grupo: a mesma pessoa tem posições diferentes em cada vôlei.
    const ranked = [...allStats].sort((a, b) => b.winPercentage - a.winPercentage);
    const position = ranked.findIndex((entry) => entry.playerId === playerId);
    this.ranking.set(position >= 0 ? position + 1 : null);

    this.recent.set(this.buildRecent(matches.slice(0, 8), tournaments, playerId));
  }

  private buildRecent(
    matches: readonly Match[],
    tournaments: readonly Tournament[],
    playerId: string,
  ): RecentMatch[] {
    const byId = new Map<string, readonly string[]>();
    for (const tournament of tournaments) {
      for (const team of tournament.teams) {
        byId.set(team.id, team.playerIds);
      }
    }

    const names = new Map(this.allPlayers().map((entry) => [entry.id, entry.name]));

    const label = (teamId: string) =>
      (byId.get(teamId) ?? [])
        .map((id) => names.get(id) ?? '?')
        .join(' + ')
        .toUpperCase();

    return matches.map((match) => {
      const mineIsA = byId.get(match.teamAId)?.includes(playerId) ?? false;
      const myTeamId = mineIsA ? match.teamAId : match.teamBId;
      const theirTeamId = mineIsA ? match.teamBId : match.teamAId;

      return {
        id: match.id,
        when: `${formatDayMonthFromIso(match.playedAt)} ${formatTime(match.playedAt)}`,
        phase: phaseLabel(match.phase),
        mine: label(myTeamId),
        theirs: label(theirTeamId),
        myScore: mineIsA ? match.scoreA : match.scoreB,
        theirScore: mineIsA ? match.scoreB : match.scoreA,
        won: match.winnerId === myTeamId,
      };
    });
  }

  protected edit(): void {
    void this.router.navigate(['/g', this.group.groupId(), 'jogadores', this.playerId(), 'editar']);
  }

  protected back(): void {
    void this.router.navigate(['/g', this.group.groupId(), 'jogadores']);
  }
}
