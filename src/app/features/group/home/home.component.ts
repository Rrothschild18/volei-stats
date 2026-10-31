import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppFacade } from '../../../core/facade/app.facade';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import { SessionStore } from '../../../core/stores/session.store';
import { LiveTournamentStore } from '../../../core/stores/live-tournament.store';
import { StatisticsService } from '../../../core/services/statistics.service';
import { BracketMatch } from '../../../core/services/tournament.service';
import { formatShortDate, todayDateString } from '../../../shared/utils/date.util';
import {
  BlueprintComponent,
  HeroFieldComponent,
  IconComponent,
  InlineNoteComponent,
  LadderComponent,
  RoleTagComponent,
  RootHeaderComponent,
  SectionBandComponent,
  SpecListComponent,
  StatGridComponent,
} from '../../../shared/ui';
import { IconName } from '../../../shared/ui';
import { ScoreSheetComponent } from '../tournaments/score-sheet.component';

interface Shortcut {
  readonly label: string;
  readonly icon: IconName;
  readonly target: string[];
}

/**
 * Início do vôlei (1a e 1c).
 *
 * Responde "o que está acontecendo agora": quem não está jogando vê o jogo em quadra e os
 * atalhos do dia; o jogador vê o jogo dele, o que acontece se vencer e o dia
 * dele.
 */
@Component({
  selector: 'app-home',
  imports: [
    BlueprintComponent,
    HeroFieldComponent,
    IconComponent,
    InlineNoteComponent,
    LadderComponent,
    RoleTagComponent,
    RootHeaderComponent,
    ScoreSheetComponent,
    SectionBandComponent,
    SpecListComponent,
    StatGridComponent,
  ],
  template: `
    <app-root-header [context]="context()" [title]="title()" (switchGroup)="toGroups()">
      <app-role-tag
        slot="role"
        [isOwner]="group.isOwner()"
        [playerName]="group.me()?.name ?? null"
      />
    </app-root-header>

    <div class="flex flex-col gap-5 pb-6">
      @if (!group.canPlay()) {
        <!--
          Visitante: entrou pelo código e ainda não disse quem é. Ele lê tudo e
          não escreve nada — inclusive não aparece na presença. Então a primeira
          coisa na tela é o caminho de resolver isso.
        -->
        <app-blueprint class="mx-4 mt-4 p-4">
          <p class="kicker">VOCÊ ESTÁ SÓ OLHANDO</p>
          <h2 class="mt-1 font-heading text-[22px] leading-none font-semibold uppercase">
            Diga quem você é
          </h2>
          <p class="mt-2 text-[13px] muted">
            Enquanto não disser, você não entra na presença nem lança placar. Toque no seu nome e
            use a data que o grupo combinou.
          </p>
          <button type="button" class="btn btn-primary mt-3 min-h-12 w-full" (click)="claim()">
            SOU UM DELES
          </button>
        </app-blueprint>
      }

      @if (!sessionStore.session()) {
        <app-hero-field class="mt-4" kicker="HOJE">
          <p class="font-heading text-[28px] leading-none font-semibold uppercase">
            Sem sessão hoje
          </p>
          <p class="text-[14px] text-accent-200">
            @if (group.canPlay()) {
              Marque quem apareceu para abrir a sessão do dia.
            } @else {
              Quando alguém marcar a presença, o seu jogo aparece aqui.
            }
          </p>
          @if (group.canPlay()) {
            <button
              type="button"
              class="btn btn-inverted"
              (click)="go(['campeonatos', 'sessoes', 'nova'])"
            >
              <app-icon name="plus" [size]="20" />
              NOVA SESSÃO
            </button>
          }
        </app-hero-field>
      } @else if (currentMatch(); as bracket) {
        <app-hero-field class="mt-4" [kicker]="heroKicker()" [live]="true">
          <p class="text-[13px] text-accent-200">{{ heroMeta() }}</p>
          <div class="flex flex-col gap-1">
            @for (side of heroSides(); track side.teamId) {
              <p class="flex items-center gap-2">
                <span class="font-heading text-[26px] leading-none font-semibold uppercase">{{
                  side.label
                }}</span>
                @if (side.mine) {
                  <span class="text-[15px] text-accent-300">· você</span>
                }
                @if (side.note) {
                  <span class="tag border border-accent-400 text-accent-200">{{ side.note }}</span>
                }
              </p>
            }
          </div>

          @if (group.canPlay()) {
            <div class="grid grid-cols-[2fr_1fr] gap-2">
              <button type="button" class="btn btn-inverted" (click)="openScore(bracket)">
                <app-icon name="square-pen" [size]="20" />
                LANÇAR PLACAR
              </button>
              <button
                type="button"
                class="btn border-accent-600 text-accent-200"
                (click)="openLive()"
              >
                CHAVE
              </button>
            </div>
          } @else if (canReport()) {
            <button type="button" class="btn btn-inverted" (click)="openScore(bracket)">
              <app-icon name="square-pen" [size]="20" />
              LANÇAR PLACAR
            </button>
            <p class="text-[13px] text-accent-200">
              Qualquer jogador desta partida pode lançar. O primeiro placar salvo trava.
            </p>
          }
        </app-hero-field>
      } @else if (live() && liveStore.paused()) {
        <app-blueprint class="mx-4 mt-4 flex flex-col gap-2 p-4">
          <app-icon name="hand" [size]="26" class="text-accent-700" />
          <h2 class="font-heading text-[22px] font-semibold uppercase">Chave pausada</h2>
          <p class="text-[14px]">
            @if (group.canPlay()) {
              Registre quem venceu o par-ou-ímpar na tela do campeonato.
            } @else {
              Quem está jogando registra quem venceu. Puxe para atualizar.
            }
          </p>
          <button type="button" class="btn btn-secondary mt-1 self-start px-3" (click)="openLive()">
            VER CAMPEONATO
          </button>
        </app-blueprint>
      }

      @if (group.canPlay()) {
        <div class="mx-4 grid grid-cols-3 border border-divider">
          @for (shortcut of shortcuts(); track shortcut.label; let first = $first) {
            <button
              type="button"
              class="flex h-[76px] flex-col items-center justify-center gap-2 text-[13px] tracking-[0.04em] uppercase"
              [class.border-l]="!first"
              [class.border-divider]="!first"
              (click)="go(shortcut.target)"
            >
              <app-icon [name]="shortcut.icon" [size]="22" class="text-accent-700" />
              {{ shortcut.label }}
            </button>
          }
        </div>

        <section class="px-4">
          <app-section-band index="01" label="DESTAQUES DO GRUPO">
            <button type="button" class="text-[13px] text-accent-700" (click)="go(['rankings'])">
              Rankings
            </button>
          </app-section-band>
          <app-blueprint>
            <app-spec-list
              [items]="highlights()"
              note="Melhor dupla exige 3 jogos juntos. Esperas contam só a proposta escolhida."
            />
          </app-blueprint>
        </section>

        <div class="px-4">
          <app-stat-grid [items]="groupStats()" />
        </div>
      } @else {
        @if (myPath().length > 0) {
          <section class="px-4">
            <app-section-band index="01" label="SE VOCÊS VENCEREM" />
            <app-ladder [steps]="myPath()" />
          </section>
        }

        <section class="px-4">
          <app-section-band index="02" label="SEU DIA">
            <button type="button" class="text-[13px] text-accent-700" (click)="openProfile()">
              Seu perfil
            </button>
          </app-section-band>
          <app-stat-grid [items]="myDay()" />
          @if (waitNote(); as note) {
            <app-inline-note class="mt-3" tone="positive" icon="hourglass">{{
              note
            }}</app-inline-note>
          }
        </section>

        @if (live(); as tournament) {
          <div class="px-4">
            <app-blueprint>
              <button
                type="button"
                class="flex w-full items-center gap-3 p-4 text-left"
                (click)="openLive()"
              >
                <app-icon name="git-fork" [size]="22" class="text-accent-700" />
                <span class="flex-1">
                  <span class="block font-heading text-[18px] font-semibold uppercase"
                    >Chave ao vivo</span
                  >
                  <span class="block text-[13px] muted">
                    {{ tournament.name }} · {{ progress() }}
                  </span>
                </span>
                <app-icon name="chevron-right" [size]="20" class="muted" />
              </button>
            </app-blueprint>
          </div>
        }
      }
    </div>

    @if (scoreTarget(); as bracket) {
      <app-score-sheet [bracket]="bracket" (closed)="closeScore()" />
    }
  `,
  host: { class: 'block' },
})
export class HomeComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly facade = inject(AppFacade);
  private readonly statistics = inject(StatisticsService);
  protected readonly group = inject(CurrentGroupStore);
  protected readonly sessionStore = inject(SessionStore);
  protected readonly liveStore = inject(LiveTournamentStore);

  protected readonly scoreTarget = signal<BracketMatch | null>(null);
  private readonly dashboard = signal<Awaited<
    ReturnType<StatisticsService['getDashboardData']>
  > | null>(null);

  protected readonly live = this.sessionStore.liveTournament;

  protected readonly context = computed(
    () =>
      `${this.group.group()?.name?.toUpperCase() ?? ''} · ${formatShortDate(todayDateString())}`,
  );

  /**
   * Tenho jogo neste campeonato?
   *
   * É o que decide a cara da tela. Antes a pergunta era "sou admin?", mas agora
   * todo mundo joga e todo mundo organiza — quem não está em quadra é que
   * precisa da visão do campeonato, não quem tem um papel.
   */
  private readonly myBracket = computed(() => this.liveStore.myMatch());

  protected readonly title = computed(() => (this.myBracket() ? 'SEU JOGO' : 'INÍCIO'));

  /** Quem joga vê o jogo dele; quem não joga vê o que está em quadra. */
  protected readonly currentMatch = computed(() => {
    if (this.liveStore.paused()) {
      return null;
    }
    return this.myBracket() ?? this.liveStore.currentMatch();
  });

  protected readonly heroKicker = computed(() => {
    if (!this.myBracket()) {
      return 'AGORA EM QUADRA';
    }

    const bracket = this.currentMatch();
    if (!bracket) {
      return 'VOCÊ ESTÁ DE ESPERA';
    }

    return bracket === this.liveStore.currentMatch() ? 'VOCÊ ESTÁ EM QUADRA' : 'VOCÊ JOGA A SEGUIR';
  });

  protected readonly heroMeta = computed(() => {
    const bracket = this.currentMatch();
    const tournament = this.live();
    if (!bracket || !tournament) {
      return '';
    }

    const phase =
      this.liveStore.ladder().find((step) => step.phase === bracket.phase)?.phaseLabel ?? '';
    return this.myBracket() ? phase : `${tournament.name} · ${phase}`;
  });

  protected readonly heroSides = computed(() => {
    const bracket = this.currentMatch();
    if (!bracket) {
      return [];
    }

    const playerId = this.group.playerId();
    const sides = [bracket.teamAId, bracket.teamBId].map((teamId) => ({
      teamId,
      label: this.liveStore.teamLabel(teamId),
      mine: this.liveStore.teamHas(teamId, playerId),
      note:
        this.liveStore
          .ladder()
          .flatMap((step) => [step.a, step.b])
          .find((side) => side.teamId === teamId)?.note ?? null,
    }));

    // Quando é o meu jogo, a minha dupla vem primeiro.
    return this.myBracket() ? sides.sort((a, b) => Number(b.mine) - Number(a.mine)) : sides;
  });

  protected readonly canReport = computed(() => {
    const bracket = this.currentMatch();
    if (!bracket || this.liveStore.findSavedMatch(bracket)) {
      return false;
    }
    // Qualquer jogador lança o placar de qualquer partida: o dono pode estar
    // em quadra, e o jogo não para esperando ele.
    return this.group.canPlay();
  });

  protected readonly shortcuts = computed<Shortcut[]>(() => {
    const session = this.sessionStore.session();
    const present = this.sessionStore.present().length;
    const tournaments = this.sessionStore.tournaments().length;

    return [
      {
        label: 'Novo sorteio',
        icon: 'dices',
        target: session
          ? ['campeonatos', 'sessoes', session.id, 'sorteio']
          : ['campeonatos', 'sessoes', 'nova'],
      },
      {
        label: `Presença · ${present}`,
        icon: 'list-checks',
        target: session
          ? ['campeonatos', 'sessoes', session.id]
          : ['campeonatos', 'sessoes', 'nova'],
      },
      { label: `Campeonatos · ${tournaments}`, icon: 'trophy', target: ['campeonatos'] },
    ];
  });

  protected readonly highlights = computed(() => {
    const data = this.dashboard();
    if (!data) {
      return [];
    }

    return [
      { label: 'Mais vitórias', value: data.topWinsPlayer ?? '—', figure: data.topWinsCount },
      {
        label: 'Melhor aproveitamento',
        value: data.topWinPctPlayer ?? '—',
        figure: `${data.topWinPctValue}%`,
      },
      { label: 'Melhor dupla', value: data.topTeam ?? '—', figure: `${data.topTeamWinPct}%` },
      {
        label: 'Mais esperou',
        value: data.mostWaitedPlayer ?? '—',
        figure: `${data.mostWaitedCount}×`,
      },
    ];
  });

  protected readonly groupStats = computed(() => {
    const data = this.dashboard();
    return [
      { value: data?.totalMatches ?? 0, label: 'partidas' },
      { value: data?.totalActivePlayers ?? 0, label: 'jogadores ativos' },
      { value: data?.totalDraws ?? 0, label: 'sorteios' },
    ];
  });

  protected readonly myPath = computed(() => this.liveStore.myPath());

  protected readonly myDay = computed(() => {
    const playerId = this.group.playerId();
    const sessionId = this.sessionStore.session()?.id;
    if (!sessionId) {
      return [];
    }

    const teams = new Map<string, readonly string[]>();
    for (const tournament of this.sessionStore.tournaments()) {
      for (const team of tournament.teams) {
        teams.set(team.id, team.playerIds);
      }
    }

    let games = 0;
    let wins = 0;
    for (const match of this.sessionStore.matches()) {
      if (!match.winnerId) {
        continue;
      }
      const mine = [match.teamAId, match.teamBId].find(
        (teamId) => playerId !== null && teams.get(teamId)?.includes(playerId),
      );
      if (!mine) {
        continue;
      }
      games++;
      if (match.winnerId === mine) {
        wins++;
      }
    }

    const waits = (playerId && this.sessionStore.waitCounts().get(playerId)) ?? 0;

    return [
      { value: games, label: games === 1 ? 'jogo' : 'jogos' },
      { value: wins, label: wins === 1 ? 'vitória' : 'vitórias' },
      { value: waits, label: 'espera hoje' },
    ];
  });

  protected readonly waitNote = computed(() => {
    const playerId = this.group.playerId();
    const waits = (playerId && this.sessionStore.waitCounts().get(playerId)) ?? 0;
    if (waits === 0) {
      return null;
    }

    const yetToWait = this.sessionStore.yetToWait();
    return `Você já esperou hoje — não espera de novo enquanto ${yetToWait === 1 ? 'alguém' : `${yetToWait} pessoas`} ainda não ${yetToWait === 1 ? 'esperou' : 'esperaram'}.`;
  });

  protected readonly progress = computed(() => {
    const played = this.liveStore.completedMatches().length;
    const total = this.liveStore.ladder().length;
    return `${played} de ${total} jogos`;
  });

  async ngOnInit(): Promise<void> {
    const groupId = this.group.groupId();
    if (!groupId) {
      return;
    }

    await this.sessionStore.load(groupId);

    const live = this.sessionStore.liveTournament();
    if (live) {
      await this.liveStore.load(live.id);
    }

    this.dashboard.set(
      await this.statistics.getDashboardData(await this.facade.getGroupScope(groupId)),
    );
  }

  protected openScore(bracket: BracketMatch): void {
    this.scoreTarget.set(bracket);
  }

  protected async closeScore(): Promise<void> {
    this.scoreTarget.set(null);
    const groupId = this.group.groupId();
    if (groupId) {
      await this.sessionStore.load(groupId);
    }
    await this.liveStore.reload();
  }

  protected openLive(): void {
    const live = this.live();
    if (live) {
      this.go(['campeonatos', live.id]);
    }
  }

  protected claim(): void {
    this.go(['sou-quem']);
  }

  protected openProfile(): void {
    const playerId = this.group.playerId();
    if (playerId) {
      this.go(['jogadores', playerId]);
    }
  }

  protected go(segments: string[]): void {
    void this.router.navigate(['/g', this.group.groupId(), ...segments]);
  }

  protected toGroups(): void {
    void this.router.navigate(['/voleis']);
  }
}
