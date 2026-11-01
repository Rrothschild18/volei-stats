import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppFacade } from '../../../core/facade/app.facade';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import { LiveTournamentStore } from '../../../core/stores/live-tournament.store';
import { SessionStore } from '../../../core/stores/session.store';
import { TournamentService } from '../../../core/services/tournament.service';
import { DrawService } from '../../../core/services/draw.service';
import { TournamentPriorityEntry } from '../../../shared/models';
import { formatTime } from '../../../shared/utils/date.util';
import {
  CORRECTION_WINDOW_MINUTES,
  formatDuration,
  tournamentTiming,
} from '../../../core/rules/tournament-timing';
import {
  ActionBarComponent,
  BlueprintComponent,
  BusyDirective,
  HeroFieldComponent,
  IconComponent,
  InlineNoteComponent,
  InnerHeaderComponent,
  SectionBandComponent,
} from '../../../shared/ui';

interface StandingRow {
  readonly position: number;
  readonly teamId: string;
  readonly label: string;
  readonly record: string;
  readonly balance: string;
  readonly tag: string | null;
  readonly isMine: boolean;
}

/**
 * Classificação final (1t) e o resultado do jogador (1u).
 *
 * A dupla desfeita no encaixe não ocupa posição na tabela — ela deixou de
 * existir no meio do campeonato e aparece como nota de rodapé (REGRAS.md §4.6).
 */
@Component({
  selector: 'app-standings',
  imports: [
    ActionBarComponent,
    BlueprintComponent,
    BusyDirective,
    HeroFieldComponent,
    IconComponent,
    InlineNoteComponent,
    InnerHeaderComponent,
    SectionBandComponent,
  ],
  template: `
    <app-inner-header
      context="CAMPEONATO · FINALIZADO"
      [title]="store.tournament()?.name ?? ''"
      (back)="back()"
    >
      @if (group.isOwner()) {
        <button
          type="button"
          class="btn btn-ghost btn-icon border-0"
          aria-label="Mais ações"
          [attr.aria-expanded]="menuOpen()"
          (click)="menuOpen.set(!menuOpen())"
        >
          <app-icon name="ellipsis-vertical" [size]="22" />
        </button>
      }
    </app-inner-header>

    <div class="flex flex-col gap-5 px-4 pb-6">
      @if (myPosition() === null) {
        @if (champions(); as team) {
          <app-blueprint class="flex flex-col gap-1 p-4">
            <app-icon name="crown" [size]="34" class="text-accent-700" />
            <p class="kicker">{{ championsKicker() }}</p>
            <p class="font-heading text-[36px] leading-none font-semibold uppercase">
              {{ team.label }}
            </p>
          </app-blueprint>
        }
      } @else {
        <app-hero-field kicker="SEU RESULTADO">
          <p class="flex items-baseline gap-3">
            <span class="font-heading text-[56px] leading-none font-semibold">{{
              myPosition() ?? '—'
            }}</span>
            <span class="font-heading text-[18px] font-semibold uppercase">{{ myNote() }}</span>
          </p>
        </app-hero-field>
      }

      <p class="text-[13px] tnum muted">{{ timing() }}</p>

      <section>
        <table class="w-full border-collapse">
          <caption class="sr-only">
            Classificação final do campeonato
          </caption>
          <thead>
            <tr class="bg-accent-100 text-[11px] tracking-[0.06em] uppercase">
              <th class="w-7 py-2 pl-1 text-left font-semibold">Nº</th>
              <th class="py-2 text-left font-semibold">Dupla</th>
              <th class="w-11 py-2 text-right font-semibold">V–D</th>
              <th class="w-10 py-2 pr-1 text-right font-semibold">Saldo</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.teamId) {
              <tr class="row-rule h-11" [class.bg-accent-100]="row.isMine">
                <td class="pl-1 text-[13px] tnum muted">{{ row.position }}</td>
                <td>
                  <span class="flex items-center gap-2">
                    <span class="font-heading text-[17px] font-semibold uppercase">{{
                      row.label
                    }}</span>
                    @if (row.tag) {
                      <span class="tag tag-neutral">{{ row.tag }}</span>
                    }
                  </span>
                </td>
                <td class="text-right text-[14px] tnum">{{ row.record }}</td>
                <td class="pr-1 text-right text-[14px] tnum">{{ row.balance }}</td>
              </tr>
            }
          </tbody>
        </table>

        @if (dissolvedNote(); as note) {
          <p class="mt-2 text-[12px] muted">{{ note }}</p>
        }
      </section>

      @if (nextDraw()) {
        <section>
          <app-section-band label="O PRÓXIMO JÁ ESTÁ SORTEADO" [meta]="nextDrawMeta()" />
          @for (row of nextDrawRows(); track row.teamId) {
            <div class="row-rule flex h-10 items-center gap-3">
              <span class="w-6 font-heading text-[17px] font-semibold text-accent-700 tnum">{{
                row.order
              }}</span>
              <span class="flex-1 font-heading text-[17px] font-semibold uppercase">{{
                row.label
              }}</span>
            </div>
          }
          @if (nextDrawWaiting(); as name) {
            <p class="mt-2 text-[12px] muted">{{ name }} fica de espera.</p>
          }

          @if (presenceNote(); as note) {
            <div class="mt-3">
              <app-inline-note tone="error">{{ note }}</app-inline-note>
            </div>
          }

          <button
            type="button"
            class="mt-3 flex items-center gap-2 text-[13px] text-accent-700"
            [disabled]="busy()"
            (click)="discardNext()"
          >
            <app-icon name="x" [size]="16" />
            Descartar este sorteio
          </button>
        </section>
      }

      @if (priorities().length > 0) {
        <section>
          <app-section-band label="PRIORIDADE NO PRÓXIMO SORTEIO" />
          @for (entry of priorities(); track entry.playerId) {
            <div class="row-rule flex h-10 items-center gap-3">
              <span class="font-heading text-[17px] font-semibold uppercase">{{
                nameOf(entry.playerId)
              }}</span>
              <span class="flex-1 text-right text-[13px] muted">{{ reasonLabel(entry) }}</span>
            </div>
          }
        </section>
      }

      @if (group.canPlay()) {
        <!--
          Sem este caminho, um placar errado num campeonato encerrado ficava
          errado para sempre: a tela do campeonato redireciona para cá, e o
          botão de corrigir mora lá. A frase "qualquer jogador corrige" não
          valia depois do último jogo.

          Passado o prazo, o botão SAI — não fica desabilitado com explicação
          em tooltip. Um botão cinza convida a tentar, e a tela em vez dele diz
          o que aconteceu (ticket 35).
        -->
        @if (store.correctionOpen()) {
          <button
            type="button"
            class="flex items-center gap-2 self-start text-[13px] text-accent-700"
            (click)="correctScores()"
          >
            <app-icon name="pencil" [size]="16" />
            Errou um placar? Corrigir as partidas deste campeonato
          </button>
        } @else {
          <p class="text-[13px] muted">
            Este campeonato fechou. Placar só até {{ correctionMinutes }} min depois do fim.
          </p>
        }
      }

      @if (group.isOwner() && menuOpen()) {
        <button
          type="button"
          class="flex items-center gap-2 self-start text-[13px] text-accent-700"
          (click)="confirmingDelete.set(true)"
        >
          <app-icon name="trash-2" [size]="16" />
          Excluir campeonato (some das prioridades e estatísticas)
        </button>
      }
    </div>

    @if (group.canPlay()) {
      <app-action-bar [withTabBar]="true">
        <!--
          Com o próximo já sorteado, o botão não convida a sortear de novo: a
          parte lenta da noite (três propostas, trocas, conversa) já aconteceu
          enquanto a bola rolava (ticket 36). Com a presença diferente da do
          sorteio, ele volta a ser o sorteio — um sorteio pendente não vira
          campeonato com gente ausente.
        -->
        <button
          type="button"
          class="btn btn-primary blueprint h-13 text-[17px]"
          (click)="canStartNext() ? startNext() : newDraw()"
        >
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i>
          <i class="corner br"></i>
          <app-icon [name]="canStartNext() ? 'trophy' : 'dices'" [size]="20" />
          {{ canStartNext() ? 'COMEÇAR O PRÓXIMO' : 'NOVO SORTEIO' }}
        </button>
      </app-action-bar>
    }

    @if (confirmingDelete()) {
      <div class="dialog-backdrop items-center">
        <app-blueprint
          class="dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Excluir campeonato"
        >
          <h3 class="font-heading text-[20px] font-semibold uppercase">Excluir campeonato?</h3>
          <p class="text-[14px]">
            Ele sai das prioridades do próximo sorteio e das estatísticas de todo mundo. Não tem
            como desfazer.
          </p>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="btn btn-secondary"
              [disabled]="busy()"
              (click)="confirmingDelete.set(false)"
            >
              CANCELAR
            </button>
            <button
              type="button"
              class="btn btn-danger"
              [appBusy]="busy()"
              [disabled]="busy()"
              (click)="remove()"
            >
              EXCLUIR
            </button>
          </div>
        </app-blueprint>
      </div>
    }
  `,
  host: { class: 'block' },
})
export class StandingsComponent implements OnInit {
  private readonly facade = inject(AppFacade);
  private readonly tournaments = inject(TournamentService);
  private readonly draws = inject(DrawService);
  private readonly router = inject(Router);
  protected readonly group = inject(CurrentGroupStore);
  protected readonly store = inject(LiveTournamentStore);
  private readonly sessions = inject(SessionStore);

  readonly tournamentId = input.required<string>();

  /** O prazo, para a frase da tela e a recusa da store dizerem o mesmo número. */
  protected readonly correctionMinutes = CORRECTION_WINDOW_MINUTES;

  protected readonly menuOpen = signal(false);
  protected readonly confirmingDelete = signal(false);
  protected readonly busy = signal(false);

  private readonly stats = computed(() => {
    const tournament = this.store.tournament();
    if (!tournament) {
      return new Map<string, { wins: number; losses: number; diff: number }>();
    }

    const tally = new Map<string, { wins: number; losses: number; diff: number }>();
    for (const team of tournament.teams) {
      tally.set(team.id, { wins: 0, losses: 0, diff: 0 });
    }

    for (const match of this.store.completedMatches()) {
      const a = tally.get(match.teamAId);
      const b = tally.get(match.teamBId);
      if (a) {
        a.diff += match.scoreA - match.scoreB;
        if (match.winnerId === match.teamAId) {
          a.wins++;
        } else {
          a.losses++;
        }
      }
      if (b) {
        b.diff += match.scoreB - match.scoreA;
        if (match.winnerId === match.teamBId) {
          b.wins++;
        } else {
          b.losses++;
        }
      }
    }

    return tally;
  });

  protected readonly rows = computed<StandingRow[]>(() => {
    const tournament = this.store.tournament();
    if (!tournament) {
      return [];
    }

    const standings =
      tournament.finalStandings.length > 0
        ? tournament.finalStandings
        : this.tournaments.computeFinalStandings(tournament, [...this.store.completedMatches()]);

    const tally = this.stats();
    const placement = tournament.oddPlayerPlacement;
    const playerId = this.group.playerId();

    return standings
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((standing) => {
        const entry = tally.get(standing.teamId) ?? { wins: 0, losses: 0, diff: 0 };
        const team = tournament.teams.find((candidate) => candidate.id === standing.teamId);

        return {
          position: standing.position,
          teamId: standing.teamId,
          label: this.store.teamLabel(standing.teamId),
          record: `${entry.wins}–${entry.losses}`,
          balance: entry.diff > 0 ? `+${entry.diff}` : `${entry.diff}`,
          tag:
            standing.teamId === placement?.encaixeTeamId
              ? 'encaixe'
              : team?.eliminatedDirectly
                ? 'eliminação direta'
                : null,
          isMine: playerId !== null && !!team?.playerIds.includes(playerId),
        };
      });
  });

  protected readonly champions = computed(() => this.rows()[0] ?? null);

  protected readonly championsKicker = computed(() => {
    const champion = this.champions();
    if (!champion) {
      return '';
    }
    const wins = champion.record.split('–')[0];
    return `CAMPEÕES · ${wins} ${wins === '1' ? 'VITÓRIA' : 'VITÓRIAS'} · SALDO ${champion.balance}`;
  });

  protected readonly myRow = computed(() => this.rows().find((row) => row.isMine) ?? null);

  protected readonly myPosition = computed(() => {
    const row = this.myRow();
    return row ? `${row.position}º` : null;
  });

  protected readonly myNote = computed(() => {
    const row = this.myRow();
    const tournament = this.store.tournament();
    if (!row || !tournament) {
      return '';
    }

    const team = tournament.teams.find((candidate) => candidate.id === row.teamId);
    const partnerId = team?.playerIds.find((playerId) => playerId !== this.group.playerId());
    const partner = this.store.playerName(partnerId ?? null);
    const viaEncaixe = row.teamId === tournament.oddPlayerPlacement?.encaixeTeamId;

    return `COM ${partner?.toUpperCase() ?? '?'}${viaEncaixe ? ', PELO ENCAIXE' : ''} · ${row.record}`;
  });

  /** A dupla original desfeita no encaixe: fora da tabela, dita no rodapé. */
  protected readonly dissolvedNote = computed(() => {
    const tournament = this.store.tournament();
    const placement = tournament?.oddPlayerPlacement;
    if (!placement) {
      return null;
    }

    const original = this.store.teamLabel(placement.sourceTeamId);
    const surviving = this.store.playerName(placement.survivingPlayerId);
    const eliminated = this.store.playerName(placement.eliminatedPlayerId);
    const waiting = this.store.playerName(tournament?.waitingPlayerId ?? null);

    return `${original} — dupla original, desfeita no encaixe: ${surviving} venceu o par-ou-ímpar e jogou com ${waiting}; ${eliminated} saiu.`;
  });

  protected readonly priorities = computed(() => this.store.tournament()?.priorityEntries ?? []);

  /** O próximo campeonato, se ele já foi sorteado (ticket 36). */
  protected readonly nextDraw = this.sessions.pendingDraw;

  protected readonly nextDrawMeta = computed(() => {
    const draw = this.nextDraw();
    if (!draw) {
      return null;
    }
    const pairs = `${draw.teams.length} duplas`;
    return draw.waitingPlayerId ? `${pairs} + avulso` : pairs;
  });

  protected readonly nextDrawRows = computed(() => {
    const draw = this.nextDraw();
    if (!draw) {
      return [];
    }

    const byId = this.sessions.playersById();
    return draw.teams.map((team, index) => ({
      teamId: team.id,
      order: index + 1,
      label: team.playerIds
        .map((playerId) => byId.get(playerId)?.name ?? '?')
        .join(' + ')
        .toUpperCase(),
    }));
  });

  protected readonly nextDrawWaiting = computed(() => {
    const waitingPlayerId = this.nextDraw()?.waitingPlayerId;
    return waitingPlayerId
      ? (this.sessions.playersById().get(waitingPlayerId)?.name ?? null)
      : null;
  });

  /**
   * A presença mudou desde o sorteio adiantado: alguém foi embora, alguém
   * chegou. O sorteio pendente aponta para gente que não está mais aqui, ou
   * deixa de fora quem chegou — e isso é apontado, não usado em silêncio.
   */
  protected readonly presenceNote = computed(() => {
    const diff = this.sessions.pendingDrawPresence();
    if (!diff || this.sessions.pendingDrawMatchesPresence()) {
      return null;
    }

    const byId = this.sessions.playersById();
    const names = (ids: readonly string[]) =>
      ids.map((playerId) => byId.get(playerId)?.name ?? '?').join(', ');

    const partes: string[] = [];
    if (diff.gone.length > 0) {
      partes.push(
        diff.gone.length === 1
          ? `${names(diff.gone)} está no sorteio e não está mais aqui`
          : `${names(diff.gone)} estão no sorteio e não estão mais aqui`,
      );
    }
    if (diff.arrived.length > 0) {
      partes.push(
        diff.arrived.length === 1
          ? `${names(diff.arrived)} chegou depois e ficou de fora`
          : `${names(diff.arrived)} chegaram depois e ficaram de fora`,
      );
    }

    return `${partes.join('; ')}. Sorteie de novo antes de começar.`;
  });

  /**
   * Só começa o próximo quando o sorteio ainda descreve quem está aqui — e
   * quando não há campeonato rolando.
   *
   * O segundo é o que mantém a sessão com um campeonato `'in-progress'` só:
   * esta tela se alcança por URL mesmo com a bola em jogo, e dali criar o
   * próximo daria dois ao vivo ao mesmo tempo (ticket 36).
   */
  protected readonly canStartNext = computed(
    () =>
      !!this.nextDraw() &&
      this.sessions.pendingDrawMatchesPresence() &&
      !this.sessions.liveTournament(),
  );

  async ngOnInit(): Promise<void> {
    await this.store.load(this.tournamentId());

    // A sessão é que sabe do sorteio pendente e de quem está presente agora.
    const sessionId = this.store.tournament()?.sessionId;
    if (sessionId) {
      await this.sessions.loadById(sessionId);
    }
  }

  /** Leva o sorteio pendente para a tela de formato, e dali para o ao vivo. */
  protected startNext(): void {
    const draw = this.nextDraw();
    if (!draw) {
      return;
    }

    void this.router.navigate(['/g', this.group.groupId(), 'campeonatos', 'novo'], {
      queryParams: { drawId: draw.id },
    });
  }

  protected async discardNext(): Promise<void> {
    const sessionId = this.store.tournament()?.sessionId;
    if (!sessionId || this.busy()) {
      return;
    }

    this.busy.set(true);
    try {
      await this.draws.discardPendingDraw(sessionId);
      await this.sessions.reload();
    } finally {
      this.busy.set(false);
    }
  }

  protected nameOf(playerId: string): string {
    return this.store.playerName(playerId) ?? '?';
  }

  protected reasonLabel(entry: TournamentPriorityEntry): string {
    switch (entry.reason) {
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

  protected async remove(): Promise<void> {
    if (this.busy()) {
      return;
    }

    // O diálogo fica aberto até o banco responder. Excluir apaga partida por
    // partida, o sorteio e a sessão — fechar antes deixaria a pessoa olhando
    // uma classificação que já está sendo desmontada, sem saber se funcionou.
    this.busy.set(true);
    try {
      await this.facade.deleteTournament(this.tournamentId());
      this.confirmingDelete.set(false);
      void this.router.navigate(['/g', this.group.groupId(), 'campeonatos']);
    } finally {
      this.busy.set(false);
    }
  }

  /** "Começou 20:08 · durou 48 min". */
  protected readonly timing = computed(() => {
    const tournament = this.store.tournament();
    if (!tournament) {
      return '';
    }

    const t = tournamentTiming(
      tournament.createdAt,
      this.store.matches(),
      new Date().toISOString(),
    );
    if (t.finished && t.minutes !== null) {
      return `Começou ${formatTime(t.startedAt)} · durou ${formatDuration(t.minutes)}`;
    }
    if (t.abandoned) {
      return `Começou ${formatTime(t.startedAt)} · não terminou`;
    }
    return `Começou ${formatTime(t.startedAt)} · ainda rolando`;
  });

  /**
   * Volta para a lista de partidas do campeonato.
   *
   * O `?partidas=1` existe para desarmar o redirecionamento de lá: um
   * campeonato encerrado abre na classificação, e sem isso voltaria para cá.
   */
  protected correctScores(): void {
    void this.router.navigate(['/g', this.group.groupId(), 'campeonatos', this.tournamentId()], {
      queryParams: { partidas: 1 },
    });
  }

  protected newDraw(): void {
    const sessionId = this.store.tournament()?.sessionId;
    void this.router.navigate(
      sessionId
        ? ['/g', this.group.groupId(), 'campeonatos', 'sessoes', sessionId, 'sorteio']
        : ['/g', this.group.groupId(), 'campeonatos'],
    );
  }

  protected back(): void {
    void this.router.navigate(['/g', this.group.groupId(), 'campeonatos']);
  }
}
