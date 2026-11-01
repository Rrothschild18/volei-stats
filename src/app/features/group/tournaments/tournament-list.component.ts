import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { RefreshService } from '../../../core/refresh/refresh.service';
import { AppFacade } from '../../../core/facade/app.facade';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import { SessionStore } from '../../../core/stores/session.store';
import { TournamentService } from '../../../core/services/tournament.service';
import { phaseLabel } from '../../../core/rules/bracket-phases';
import { Player, Session, Tournament } from '../../../shared/models';
import {
  formatDayMonth,
  formatShortDate,
  formatTime,
  todayDateString,
} from '../../../shared/utils/date.util';
import {
  formatDuration,
  TournamentTiming,
  tournamentTiming,
} from '../../../core/rules/tournament-timing';
import {
  ActionBarComponent,
  BlueprintComponent,
  IconComponent,
  NavigatesDirective,
  SkeletonComponent,
  PullToRefreshComponent,
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
  /** "20:08 · 48 min". */
  readonly timing: string;
}

interface PastRow {
  readonly id: string;
  readonly date: string;
  readonly detail: string;
}

/** A aba Campeonatos: o dia de hoje e os dias anteriores (1d). */
/** "20:08 · 48 min", "20:08 · rolando há 25 min", "20:08 · não terminou". */
function describeTiming(timing: TournamentTiming): string {
  const inicio = formatTime(timing.startedAt);
  if (timing.finished && timing.minutes !== null) {
    return `${inicio} · ${formatDuration(timing.minutes)}`;
  }
  if (timing.abandoned) {
    return `${inicio} · não terminou`;
  }
  return `${inicio} · rolando há ${formatDuration(timing.minutes ?? 0)}`;
}

@Component({
  selector: 'app-tournament-list',
  imports: [
    ActionBarComponent,
    BlueprintComponent,
    IconComponent,
    NavigatesDirective,
    PullToRefreshComponent,
    RoleTagComponent,
    RootHeaderComponent,
    SectionBandComponent,
    SkeletonComponent,
  ],
  template: `
    <app-root-header [context]="context()" title="CAMPEONATOS" (switchGroup)="toGroups()">
      <app-role-tag
        slot="role"
        [isOwner]="group.isOwner()"
        [playerName]="group.me()?.name ?? null"
      />
      <app-pull-to-refresh slot="action" />
    </app-root-header>

    <div class="px-4 pt-4">
      <!--
        Enquanto as sessões não chegam, a tela NÃO diz "ninguém abriu a sessão
        de hoje" nem "nenhuma sessão anterior": são as duas frases que ela
        mostraria por falta de dado, e nenhuma delas é verdade ainda.
      -->
      @if (carregando()) {
        <app-skeleton [rows]="2" label="Carregando as sessões do vôlei…" />
        <div class="mt-6">
          <app-section-band label="HOJE" />
          <app-skeleton [rows]="3" />
        </div>
        <div class="mt-6">
          <app-section-band label="ANTERIORES" />
          <app-skeleton [rows]="3" />
        </div>
      } @else {
        <!--
        A sessão do dia é uma coisa; os campeonatos dela são outra. Antes as
        duas moravam na mesma lista, sob uma faixa que dizia "HOJE" — e a
        sessão parecia o primeiro campeonato. Agora ela é um card com destaque
        próprio, e a faixa passou a rotular só os campeonatos.
      -->
        @if (session()) {
          <button
            type="button"
            class="flex w-full items-center gap-3 border border-accent bg-accent-100 px-[14px] py-[13px] text-left"
            (click)="go(sessionTarget())"
          >
            <span class="min-w-0 flex-1">
              <span
                class="block font-heading text-[18px] leading-tight font-semibold text-accent-900 uppercase"
              >
                Sessão de hoje
              </span>
              <span class="block text-[13px] text-accent-800">
                {{ present() }} presentes · presença e revezamento de espera
              </span>
            </span>
            <app-icon name="chevron-right" [size]="18" class="text-accent-700" />
          </button>

          <section class="mt-6">
            <app-section-band
              [label]="'HOJE · ' + today().toUpperCase()"
              [meta]="tournamentMeta()"
            />

            @if (tournamentRows().length > 0) {
              <app-blueprint>
                @for (row of tournamentRows(); track row.id; let last = $last) {
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
                      <span class="block text-[12px] tnum muted">{{ row.timing }}</span>
                    </span>
                    <app-icon name="chevron-right" [size]="18" class="muted" />
                  </button>
                }
              </app-blueprint>
            } @else {
              <p class="text-[14px] muted">
                Nenhum campeonato ainda. O próximo passo é sortear as duplas.
              </p>
            }
          </section>
        } @else {
          <section>
            <app-section-band [label]="'HOJE · ' + today().toUpperCase()" meta="sem sessão" />
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
          </section>
        }

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
      }
    </div>

    @if (group.canPlay()) {
      <app-action-bar [withTabBar]="true">
        <button
          type="button"
          class="btn btn-primary blueprint h-13 text-[17px]"
          appNavigates
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
  private readonly refresh = inject(RefreshService);
  private readonly tournamentService = inject(TournamentService);
  private readonly router = inject(Router);
  protected readonly group = inject(CurrentGroupStore);
  protected readonly sessionStore = inject(SessionStore);

  /** Só a PRIMEIRA carga: puxar para atualizar não desmonta o que está na tela. */
  protected readonly carregando = signal(true);

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

  /** Para onde o card da sessão de hoje leva. */
  protected readonly sessionTarget = computed(() => {
    const session = this.session();
    return session
      ? ['/g', this.group.groupId(), 'campeonatos', 'sessoes', session.id]
      : ['/g', this.group.groupId(), 'campeonatos'];
  });

  /** O que a faixa "HOJE" diz à direita: quantos campeonatos o dia já teve. */
  protected readonly tournamentMeta = computed(() => {
    const total = this.sessionStore.tournaments().length;
    if (total === 0) {
      return 'nenhum ainda';
    }
    return total === 1 ? '1 campeonato' : `${total} campeonatos`;
  });

  protected readonly tournamentRows = computed<TodayRow[]>(() => {
    const session = this.session();
    if (!session) {
      return [];
    }

    const groupId = this.group.groupId();
    const rows: TodayRow[] = [];
    const agora = new Date().toISOString();
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
          timing: describeTiming(
            tournamentTiming(tournament.createdAt, this.sessionStore.matches(), agora),
          ),
          target: live
            ? ['/g', groupId, 'campeonatos', tournament.id]
            : ['/g', groupId, 'campeonatos', tournament.id, 'classificacao'],
        });
      });

    // O mais recente primeiro. A numeração (01, 02) segue a ordem em que foram
    // jogados, então ela não se inverte junto.
    //
    // Isto já foi `[rows[0], ...rows.slice(1).reverse()]`, de quando a sessão
    // do dia era a primeira linha desta lista e precisava ficar presa no topo.
    // Depois que ela virou um card à parte, a sessão sem campeonato nenhum
    // devolvia `[undefined]` — e a tela estourava no `track`.
    return rows.reverse();
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

  constructor() {
    // Voltar para o app, a rede voltar, ou puxar para atualizar: tudo cai aqui.
    this.refresh.register(() => this.load());
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    const groupId = this.group.groupId();
    if (!groupId) {
      this.carregando.set(false);
      return;
    }

    try {
      await this.carregar(groupId);
    } finally {
      this.carregando.set(false);
    }
  }

  private async carregar(groupId: string): Promise<void> {
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
      const pending = await this.tournamentService.getPendingMatches(live);
      this.liveNextMatch.set(pending[0] ? phaseLabel(pending[0].phase) : 'chave pausada');
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
