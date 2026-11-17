import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { RefreshService } from '../../../core/refresh/refresh.service';
import { AppFacade } from '../../../core/facade/app.facade';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import { StatsRepository } from '../../../core/repositories';
import { phaseLabel } from '../../../core/rules/bracket-phases';
import { byPlayerWins, byTeamWins } from '../../../core/rules/stats-order';
import {
  JANELA_PADRAO,
  lastSessionIds,
  sumPlayerStats,
  sumTeamStats,
} from '../../../core/rules/stats-window';
import {
  Match,
  Player,
  PlayerSessionStats,
  Session,
  TeamSessionStats,
  Tournament,
} from '../../../shared/models';
import {
  daysBetween,
  formatShortDate,
  formatTime,
  todayDateString,
} from '../../../shared/utils/date.util';
import {
  IconComponent,
  PullToRefreshComponent,
  RoleTagComponent,
  RootHeaderComponent,
  SectionBandComponent,
  SegmentedComponent,
  SkeletonComponent,
} from '../../../shared/ui';

type Tab = 'individual' | 'teams' | 'matches';
/** O recorte do mural: as últimas noites, ou o vôlei inteiro. */
type Janela = 'recente' | 'tudo';
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
  /** Dia + criação do campeonato: ordena os grupos na tela. */
  readonly sortKey: string;
  readonly rows: readonly MatchRow[];
}

/**
 * As estatísticas do grupo (1v) e o histórico de partidas (1w), que antes era
 * uma tela solta. As tabelas cabem na largura do celular: nada de rolagem
 * lateral.
 *
 * Não é um pódio, e por isso não se chama ranking: a ordem é por VITÓRIAS, um
 * contador que só sobe e premia quem aparece. Ordenar por aproveitamento
 * colocava quem jogou 7 partidas numa noite na frente de quem jogou 17 em
 * duas, e num vôlei onde parte do grupo não é competitiva isso é um ranking
 * que ninguém pediu. O `%` continua na tabela — só não manda mais na ordem.
 */
@Component({
  selector: 'app-stats',
  imports: [
    IconComponent,
    PullToRefreshComponent,
    RoleTagComponent,
    RootHeaderComponent,
    SectionBandComponent,
    SegmentedComponent,
    SkeletonComponent,
  ],
  template: `
    <app-root-header [context]="context()" title="ESTATÍSTICAS" (switchGroup)="toGroups()">
      <app-role-tag
        slot="role"
        [isOwner]="group.isOwner()"
        [playerName]="group.me()?.name ?? null"
      />
      <app-pull-to-refresh slot="action" />
    </app-root-header>

    <app-segmented
      [options]="tabs"
      [value]="tab()"
      (valueChange)="tab.set($any($event))"
      role="tablist"
    />

    <!--
      As três abas somam do banco, e nenhuma delas tem o que dizer antes de a
      soma chegar: a tabela vazia e as frases de "nenhuma dupla ainda" são
      respostas sobre o vôlei, não sobre a espera.
    -->
    @if (carregando()) {
      <div class="px-4 pt-4">
        <app-skeleton [rows]="8" label="Somando as estatísticas do vôlei…" />
      </div>
    } @else {
      <!--
        O recorte vale para as duas tabelas de números. A aba de partidas tem o
        filtro de período dela, que é outra pergunta — "quais jogos", não
        "quais noites contam no mural".
      -->
      @if (tab() !== 'matches') {
        <div class="flex flex-col gap-2 px-4 pt-4">
          <app-segmented
            [options]="janelas"
            [value]="janela()"
            (valueChange)="janela.set($any($event))"
            [tabs]="false"
          />
          <p class="text-[12px] muted" aria-live="polite">{{ recorte() }}</p>
        </div>
      }

      @switch (tab()) {
        @case ('individual') {
          <table class="w-full border-collapse">
            <caption class="sr-only">
              Estatísticas individuais do grupo
            </caption>
            <thead>
              <tr class="bg-accent-100 text-[11px] tracking-[0.06em] uppercase">
                <th class="w-9 py-2 pl-4 text-left font-semibold">Nº</th>
                <th class="py-2 text-left font-semibold">Jogador</th>
                <th class="w-8 py-2 text-right font-semibold">J</th>
                <th class="w-11 py-2 text-right font-semibold text-accent-700">V</th>
                <th class="w-9 py-2 text-right font-semibold">%</th>
                <th class="w-10 py-2 pr-4 text-right font-semibold">Esp</th>
              </tr>
            </thead>
            <tbody>
              @for (row of individual(); track row.stats.playerId; let index = $index) {
                <tr class="row-rule h-11" [class.bg-accent-100]="row.isMe">
                  <td class="pr-1 pl-4 text-[13px] tnum muted">{{ index + 1 }}</td>
                  <td class="font-heading text-[17px] font-semibold uppercase">{{ row.name }}</td>
                  <td class="text-right text-[14px] tnum">{{ row.stats.gamesPlayed }}</td>
                  <td class="text-right font-heading text-[19px] font-semibold tnum">
                    {{ row.stats.wins }}
                  </td>
                  <td class="text-right text-[14px] tnum muted">{{ row.stats.winPercentage }}</td>
                  <td class="pr-4 text-right text-[14px] tnum muted">
                    {{ row.stats.timesWaited }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <p class="px-4 py-3 text-[12px] muted">
            Ordem por vitórias — o % está aí para ler, não para classificar. Esp = vezes que
            esperou, contando só o sorteio escolhido. Só aparece quem já jogou.
          </p>
        }

        @case ('teams') {
          <table class="w-full border-collapse">
            <caption class="sr-only">
              Estatísticas das duplas do grupo
            </caption>
            <thead>
              <tr class="bg-accent-100 text-[11px] tracking-[0.06em] uppercase">
                <th class="w-7 py-2 pl-4 text-left font-semibold">Nº</th>
                <th class="py-2 text-left font-semibold">Dupla</th>
                <th class="w-8 py-2 text-right font-semibold">J</th>
                <th class="w-11 py-2 text-right font-semibold text-accent-700">V</th>
                <th class="w-10 py-2 pr-4 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              @for (row of teams(); track row.key; let index = $index) {
                <tr class="row-rule h-11" [class.bg-accent-100]="row.isMine">
                  <td class="pr-1 pl-4 text-[13px] tnum muted">{{ index + 1 }}</td>
                  <td class="font-heading text-[17px] font-semibold uppercase">{{ row.label }}</td>
                  <td class="text-right text-[14px] tnum">{{ row.stats.gamesPlayed }}</td>
                  <td class="text-right font-heading text-[19px] font-semibold tnum">
                    {{ row.stats.wins }}
                  </td>
                  <td class="pr-4 text-right text-[14px] tnum muted">
                    {{ row.stats.winPercentage }}
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="px-4 py-6 text-[14px] muted">
                    Nenhuma dupla jogou junta ainda.
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <p class="px-4 py-3 text-[12px] muted">
            Ordem por vitórias da dupla. A mesma dupla sorteada em dias diferentes conta no mesmo
            lugar.
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
    }
  `,
  host: { class: 'block pb-8' },
})
export class StatsComponent implements OnInit {
  private readonly facade = inject(AppFacade);
  private readonly refresh = inject(RefreshService);
  private readonly stats = inject(StatsRepository);
  private readonly router = inject(Router);
  protected readonly group = inject(CurrentGroupStore);

  /** Só a PRIMEIRA carga: puxar para atualizar não desmonta o que está na tela. */
  protected readonly carregando = signal(true);
  protected readonly tab = signal<Tab>('individual');
  protected readonly period = signal<Period>('today');
  protected readonly janela = signal<Janela>('recente');
  protected readonly playerFilter = signal<string | null>(null);

  protected readonly tabs = [
    { id: 'individual', label: 'Individual' },
    { id: 'teams', label: 'Duplas' },
    { id: 'matches', label: 'Partidas' },
  ];

  protected readonly janelas = [
    { id: 'recente', label: `Últimas ${JANELA_PADRAO} noites` },
    { id: 'tudo', label: 'Desde sempre' },
  ];

  protected readonly periods = [
    { id: 'today', label: 'Hoje' },
    { id: '7', label: '7 dias' },
    { id: '30', label: '30 dias' },
    { id: 'all', label: 'Tudo' },
  ];

  private readonly players = signal<readonly Player[]>([]);
  private readonly groupPlayerIds = signal<ReadonlySet<string>>(new Set());
  private readonly playerSessionStats = signal<readonly PlayerSessionStats[]>([]);
  private readonly teamSessionStats = signal<readonly TeamSessionStats[]>([]);
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

  /**
   * As noites que contam agora: as últimas, ou todas. Nulo é "desde sempre" —
   * é o que `sumPlayerStats` entende como histórico inteiro.
   */
  private readonly janelaIds = computed(() =>
    this.janela() === 'tudo' ? null : lastSessionIds(this.sessions(), JANELA_PADRAO),
  );

  /** Quantas noites a janela de fato pegou: num vôlei novo são menos de 4. */
  protected readonly noitesNaJanela = computed(
    () => this.janelaIds()?.size ?? this.sessions().length,
  );

  protected readonly individual = computed(() => {
    const names = this.namesById();
    const inGroup = this.groupPlayerIds();
    const me = this.group.playerId();

    return sumPlayerStats(this.playerSessionStats(), this.janelaIds())
      .filter((stats) => inGroup.has(stats.playerId) && stats.gamesPlayed > 0)
      .sort(byPlayerWins((playerId) => names.get(playerId) ?? ''))
      .map((stats) => ({
        stats,
        name: names.get(stats.playerId) ?? '?',
        isMe: stats.playerId === me,
      }));
  });

  protected readonly teams = computed(() => {
    const inGroup = this.groupPlayerIds();
    const me = this.group.playerId();

    const names = this.namesById();

    return (
      sumTeamStats(this.teamSessionStats(), this.janelaIds(), (id) => names.get(id) ?? '?')
        .filter((stats) => stats.playerIds.every((id) => inGroup.has(id)))
        // Sem o corte de 3 jogos: ordenada por vitórias, a dupla que jogou uma
        // vez e venceu não lidera nada, e esconder quem jogou pouco era o jeito
        // de impedir que o aproveitamento mentisse.
        .sort(byTeamWins())
        .map((stats) => ({
          key: [...stats.playerIds].sort().join('|'),
          label: stats.playerNames.join(' + '),
          stats,
          isMine: me !== null && stats.playerIds.includes(me),
        }))
    );
  });

  /** O que está somado na tela agora, dito em palavras. */
  protected readonly recorte = computed(() => {
    const noites = this.noitesNaJanela();
    const plural = noites === 1 ? 'noite' : 'noites';

    if (this.janela() === 'tudo') {
      return `Somando todo o histórico do vôlei: ${noites} ${plural}.`;
    }

    return noites < JANELA_PADRAO
      ? `Somando as ${noites} ${plural} que o vôlei tem.`
      : `Somando as últimas ${JANELA_PADRAO} noites.`;
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

    const groups = new Map<string, { label: string; sortKey: string; rows: MatchRow[] }>();

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
        entry = {
          label: `${dayLabel} · ${tournament.name.toUpperCase()}`,
          sortKey: `${session.date} ${tournament.createdAt}`,
          rows: [],
        };
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

    return (
      [...groups.entries()]
        .map(([key, entry]) => ({
          key,
          label: entry.label,
          sortKey: entry.sortKey,
          rows: entry.rows.sort((a, b) => a.time.localeCompare(b.time)),
        }))
        // Dia primeiro: a hora sozinha põe a semana passada na frente de hoje.
        .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    );
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
      await this.somar(groupId);
    } finally {
      this.carregando.set(false);
    }
  }

  private async somar(groupId: string): Promise<void> {
    // As estatísticas vêm somadas do banco: as views contam lá, por vôlei. Carregar
    // todas as partidas aqui para somar no navegador era o que o §7.12 pedia
    // para parar de fazer.
    const [groupPlayers, playerStats, teamStats, sessions] = await Promise.all([
      this.facade.getPlayersByGroupId(groupId),
      this.stats.playerSessionStats(groupId),
      this.stats.teamSessionStats(groupId),
      this.facade.getSessionsByGroupId(groupId),
    ]);

    this.players.set(groupPlayers);
    this.groupPlayerIds.set(new Set(groupPlayers.map((player) => player.id)));
    this.playerSessionStats.set(playerStats);
    this.teamSessionStats.set(teamStats);
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
