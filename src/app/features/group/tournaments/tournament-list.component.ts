import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppFacade } from '../../../core/facade/app.facade';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import { SessionStore } from '../../../core/stores/session.store';
import { TournamentService } from '../../../core/services/tournament.service';
import { phaseLabel } from '../../../core/rules/bracket-phases';
import { Player, Session, Tournament } from '../../../shared/models';
import { formatDayMonth, formatShortDate, todayDateString } from '../../../shared/utils/date.util';
import {
  ActionBarComponent,
  BlueprintComponent,
  IconComponent,
  RoleTagComponent,
  RootHeaderComponent,
  SectionBandComponent,
} from '../../../shared/ui';

interface TodayRow {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly live: boolean;
  readonly champions: boolean;
  readonly target: unknown[];
}

interface PastRow {
  readonly id: string;
  readonly date: string;
  readonly detail: string;
}

/** A aba Campeonatos: o dia de hoje e os dias anteriores (1d). */
@Component({
  selector: 'app-tournament-list',
  imports: [
    ActionBarComponent,
    BlueprintComponent,
    IconComponent,
    RoleTagComponent,
    RootHeaderComponent,
    SectionBandComponent,
  ],
  template: `
    <app-root-header [context]="context()" title="CAMPEONATOS" (switchGroup)="toGroups()">
      <app-role-tag
        slot="role"
        [isOwner]="group.isOwner()"
        [playerName]="group.me()?.name ?? null"
      />
    </app-root-header>

    <div class="px-4 pt-4">
      <section>
        <app-section-band
          [label]="'HOJE · ' + today().toUpperCase()"
          [meta]="session() ? present() + ' presentes' : 'sem sessão'"
        />

        @if (session()) {
          <app-blueprint>
            @for (row of todayRows(); track row.id; let last = $last) {
              <button
                type="button"
                class="flex w-full items-center gap-3 px-[14px] py-[13px] text-left"
                [class.row-rule]="!last"
                (click)="go(row.target)"
              >
                <span class="min-w-0 flex-1">
                  <span
                    class="block font-heading text-[18px] leading-tight font-semibold uppercase"
                  >
                    {{ row.title }}
                  </span>
                  <span
                    class="flex items-center gap-1 text-[13px]"
                    [class]="row.live ? 'text-accent-700 font-medium' : 'muted'"
                  >
                    @if (row.live) {
                      <span class="size-[7px] bg-accent-700" aria-hidden="true"></span>
                    }
                    @if (row.champions) {
                      <app-icon name="crown" [size]="14" />
                    }
                    {{ row.detail }}
                  </span>
                </span>
                <app-icon name="chevron-right" [size]="18" class="muted" />
              </button>
            }
          </app-blueprint>
        } @else {
          <app-blueprint class="p-4">
            <p class="text-[14px]">
              Ninguém abriu a sessão de hoje ainda.
              @if (group.canPlay()) {
                Marque quem apareceu para começar.
              } @else {
                Quando alguém marcar a presença, ela aparece aqui.
              }
            </p>
          </app-blueprint>
        }
      </section>

      <section class="mt-6 mb-4">
        <app-section-band label="ANTERIORES" />
        @for (row of pastRows(); track row.id) {
          <button
            type="button"
            class="row-rule flex w-full items-center gap-3 py-[13px] text-left"
            (click)="openSession(row.id)"
          >
            <span class="w-16 font-heading text-[18px] font-semibold uppercase">{{
              row.date
            }}</span>
            <span class="flex-1 text-[13px] muted">{{ row.detail }}</span>
            <app-icon name="chevron-right" [size]="18" class="muted" />
          </button>
        } @empty {
          <p class="py-4 text-[14px] muted">Nenhuma sessão anterior.</p>
        }
      </section>
    </div>

    @if (group.canPlay()) {
      <app-action-bar [withTabBar]="true">
        <button
          type="button"
          class="btn btn-primary blueprint h-13 text-[17px]"
          (click)="primaryAction()"
        >
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i>
          <i class="corner br"></i>
          @if (session()) {
            <app-icon name="dices" [size]="20" />
            NOVO SORTEIO
          } @else {
            <app-icon name="plus" [size]="20" />
            NOVA SESSÃO
          }
        </button>
      </app-action-bar>
    }
  `,
  host: { class: 'block' },
})
export class TournamentListComponent implements OnInit {
  private readonly facade = inject(AppFacade);
  private readonly tournamentService = inject(TournamentService);
  private readonly router = inject(Router);
  protected readonly group = inject(CurrentGroupStore);
  protected readonly sessionStore = inject(SessionStore);

  private readonly pastSessions = signal<readonly Session[]>([]);
  private readonly pastTournaments = signal<readonly Tournament[]>([]);
  private readonly allPlayers = signal<readonly Player[]>([]);
  private readonly liveNextMatch = signal<string | null>(null);

  protected readonly session = this.sessionStore.session;
  protected readonly present = computed(() => this.sessionStore.present().length);
  protected readonly today = computed(() => formatShortDate(todayDateString()));
  protected readonly context = computed(
    () => `${this.group.group()?.name?.toUpperCase() ?? ''} · ${this.today()}`,
  );

  protected readonly todayRows = computed<TodayRow[]>(() => {
    const session = this.session();
    if (!session) {
      return [];
    }

    const groupId = this.group.groupId();
    const rows: TodayRow[] = [
      {
        id: session.id,
        title: 'SESSÃO DE HOJE',
        detail: 'Presença e revezamento de espera',
        live: false,
        champions: false,
        target: ['/g', groupId, 'campeonatos', 'sessoes', session.id],
      },
    ];

    const names = new Map(this.allPlayers().map((player) => [player.id, player.name]));

    this.sessionStore
      .tournaments()
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .forEach((tournament, index) => {
        const live = tournament.status === 'in-progress';
        const champion = tournament.finalStandings.find((standing) => standing.position === 1);
        const championTeam = champion
          ? tournament.teams.find((team) => team.id === champion.teamId)
          : null;

        rows.push({
          id: tournament.id,
          title: `${String(index + 1).padStart(2, '0')} · ${tournament.name.toUpperCase()}`,
          detail: live
            ? `Ao vivo · ${this.liveNextMatch() ?? 'em andamento'}`
            : championTeam
              ? `Campeões · ${championTeam.playerIds.map((id) => names.get(id) ?? '?').join(' + ')}`
              : 'Finalizado',
          live,
          champions: !live && !!championTeam,
          target: live
            ? ['/g', groupId, 'campeonatos', tournament.id]
            : ['/g', groupId, 'campeonatos', tournament.id, 'classificacao'],
        });
      });

    // O mais recente primeiro, com a sessão sempre no topo.
    return [rows[0], ...rows.slice(1).reverse()];
  });

  protected readonly pastRows = computed<PastRow[]>(() => {
    const names = new Map(this.allPlayers().map((player) => [player.id, player.name]));
    const byId = new Map<string, Tournament[]>();
    for (const tournament of this.pastTournaments()) {
      byId.set(tournament.sessionId, [...(byId.get(tournament.sessionId) ?? []), tournament]);
    }

    return this.pastSessions().map((session) => {
      const tournaments = (byId.get(session.id) ?? []).sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      );
      const last = tournaments[tournaments.length - 1];
      const champion = last?.finalStandings.find((standing) => standing.position === 1);
      const championTeam = champion ? last.teams.find((team) => team.id === champion.teamId) : null;

      const parts = [
        `${session.playerIds.length} presentes`,
        `${tournaments.length} ${tournaments.length === 1 ? 'campeonato' : 'campeonatos'}`,
      ];
      if (championTeam) {
        parts.push(
          `último: ${championTeam.playerIds.map((id) => names.get(id) ?? '?').join(' + ')}`,
        );
      }

      return {
        id: session.id,
        date: formatDayMonth(session.date),
        detail: parts.join(' · '),
      };
    });
  });

  async ngOnInit(): Promise<void> {
    const groupId = this.group.groupId();
    if (!groupId) {
      return;
    }

    await this.sessionStore.load(groupId);

    const [sessions, players, tournaments] = await Promise.all([
      this.facade.getSessionsByGroupId(groupId),
      this.facade.getPlayers(),
      this.facade.getTournaments(),
    ]);

    const today = todayDateString();
    const past = sessions.filter((session) => session.date !== today);
    const pastIds = new Set(past.map((session) => session.id));

    this.pastSessions.set(past);
    this.allPlayers.set(players);
    this.pastTournaments.set(tournaments.filter((tournament) => pastIds.has(tournament.sessionId)));

    const live = this.sessionStore.liveTournament();
    if (live) {
      const next = await this.tournamentService.getNextMatches(live);
      this.liveNextMatch.set(next[0] ? phaseLabel(next[0].phase) : 'chave pausada');
    }
  }

  protected go(target: unknown[]): void {
    void this.router.navigate(target as string[]);
  }

  protected openSession(sessionId: string): void {
    void this.router.navigate(['/g', this.group.groupId(), 'campeonatos', 'sessoes', sessionId]);
  }

  /** Sem sessão hoje, abre a presença; com sessão, vai direto ao sorteio. */
  protected primaryAction(): void {
    const session = this.session();
    const base = ['/g', this.group.groupId(), 'campeonatos'];
    void this.router.navigate(
      session ? [...base, 'sessoes', session.id, 'sorteio'] : [...base, 'sessoes', 'nova'],
    );
  }

  protected toGroups(): void {
    void this.router.navigate(['/voleis']);
  }
}
