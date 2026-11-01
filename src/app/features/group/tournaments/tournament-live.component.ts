import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TeamState, teamStates } from '../../../core/rules/team-state';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import { LiveTournamentStore } from '../../../core/stores/live-tournament.store';
import { SessionStore } from '../../../core/stores/session.store';
import { BracketMatch } from '../../../core/services/tournament.service';
import { Match } from '../../../shared/models';
import { formatTime } from '../../../shared/utils/date.util';
import {
  BlueprintComponent,
  FloatingInviteComponent,
  HeroFieldComponent,
  IconComponent,
  InlineNoteComponent,
  InnerHeaderComponent,
  LadderComponent,
  RoleTagComponent,
  SectionBandComponent,
  SegmentedComponent,
  SkeletonComponent,
} from '../../../shared/ui';
import { ScoreSheetComponent } from './score-sheet.component';
import { PlacementSheetComponent } from './placement-sheet.component';
import { TiebreakSheetComponent } from './tiebreak-sheet.component';

type Tab = 'queue' | 'bracket' | 'teams';

/**
 * O convite descartado, lembrado por campeonato.
 *
 * `sessionStorage` porque a memória não precisa durar mais que a noite, e
 * porque isto não é dado do grupo: é a escolha de quem está com o telefone na
 * mão. Pode não existir (aba privada, armazenamento bloqueado), e aí o convite
 * simplesmente volta — nada quebra.
 */
const DISMISSED_KEY = 'convite-sorteio';

function readDismissed(tournamentId: string): boolean {
  try {
    return sessionStorage.getItem(`${DISMISSED_KEY}:${tournamentId}`) !== null;
  } catch {
    return false;
  }
}

function writeDismissed(tournamentId: string): void {
  try {
    sessionStorage.setItem(`${DISMISSED_KEY}:${tournamentId}`, '1');
  } catch {
    // Sem armazenamento, o convite volta na próxima visita. Tudo bem.
  }
}

/**
 * Campeonato ao vivo: a fila (1k), a chave em escada (1l/1m) e as duplas.
 *
 * Quando falta uma decisão de quadra, a chave pausa: quem joga vê o sheet para
 * registrar, e o jogador vê que está pausada (1s).
 */
@Component({
  selector: 'app-tournament-live',
  imports: [
    BlueprintComponent,
    FloatingInviteComponent,
    HeroFieldComponent,
    IconComponent,
    InlineNoteComponent,
    InnerHeaderComponent,
    LadderComponent,
    PlacementSheetComponent,
    RoleTagComponent,
    SectionBandComponent,
    SegmentedComponent,
    ScoreSheetComponent,
    SkeletonComponent,
    TiebreakSheetComponent,
  ],
  template: `
    <app-inner-header
      [context]="context()"
      [title]="store.tournament()?.name ?? ''"
      (back)="back()"
    >
      <app-role-tag [isOwner]="group.isOwner()" [playerName]="group.me()?.name ?? null" />
    </app-inner-header>

    <app-segmented [options]="tabs" [value]="tab()" (valueChange)="tab.set($any($event))" />

    <!--
      O que a correção derrubou. Fica na tela E dentro da folha de desempate:
      quando a correção reabre o empate, a folha sobe por cima de tudo, e é lá
      que a frase precisa estar. Quando o empate simplesmente deixou de existir,
      não há folha, e é aqui.
    -->
    <div class="px-4" aria-live="polite">
      @if (correctionNote(); as message) {
        <div class="mt-4 flex flex-col items-start gap-2">
          <app-inline-note tone="event">{{ message }}</app-inline-note>
          <button
            type="button"
            class="text-[13px] text-accent-700"
            (click)="store.dismissFallout()"
          >
            Entendi
          </button>
        </div>
      }
    </div>

    <!--
      Antes de a chave chegar, a tela não diz "chave pausada" nem "nenhuma
      partida concluída ainda": as duas são conclusões sobre o campeonato, e
      aqui ainda não se sabe nada dele.
    -->
    @if (store.loading()) {
      <div class="mt-4 px-4">
        <app-skeleton [rows]="3" label="Carregando a chave do campeonato…" />
        <div class="mt-6">
          <app-skeleton [rows]="4" />
        </div>
      </div>
    } @else {
      @if (store.paused() && !group.canPlay()) {
        <app-blueprint class="mx-4 mt-4 flex flex-col gap-2 p-4">
          <app-icon name="hand" [size]="26" class="text-accent-700" />
          <h2 class="font-heading text-[22px] font-semibold uppercase">Chave pausada</h2>
          <p class="font-heading text-[18px] font-semibold uppercase">{{ pausedLabel() }}</p>
          <p class="text-[14px]">Quem está jogando registra quem venceu. Puxe para atualizar.</p>
        </app-blueprint>
      }

      @switch (tab()) {
        @case ('queue') {
          <div class="flex flex-col gap-5 pb-6">
            @if (current(); as bracket) {
              <app-hero-field class="mt-4" kicker="01 · AGORA" [live]="true">
                <p class="text-[13px] text-accent-200">{{ currentPhase() }}</p>
                <div class="flex flex-col gap-1">
                  @for (side of currentSides(); track side.teamId) {
                    <p class="flex items-center gap-2">
                      <span class="font-heading text-[26px] leading-none font-semibold uppercase">{{
                        side.label
                      }}</span>
                      @if (side.note) {
                        <span class="tag border border-accent-400 text-accent-200">{{
                          side.note
                        }}</span>
                      }
                    </p>
                  }
                </div>
                @if (canReport()) {
                  <button type="button" class="btn btn-inverted" (click)="openScore(bracket)">
                    <app-icon name="square-pen" [size]="20" />
                    LANÇAR PLACAR
                  </button>
                  <p class="text-[13px] text-accent-200">
                    Qualquer jogador do vôlei pode lançar. O primeiro placar salvo trava.
                  </p>
                }
              </app-hero-field>
            }

            @if (upcoming().length > 0) {
              <section class="px-4">
                <app-section-band label="A SEGUIR" />
                @for (bracket of upcoming(); track $index) {
                  <div class="row-rule flex items-center gap-3 py-[11px]">
                    <span class="text-[12px] tracking-[0.06em] uppercase muted">{{
                      phaseOf(bracket)
                    }}</span>
                    <span class="flex-1 font-heading text-[17px] font-semibold uppercase">
                      {{ store.teamLabel(bracket.teamAId) }}
                      <span class="muted">× {{ store.teamLabel(bracket.teamBId) }}</span>
                    </span>
                    <span class="tag tag-neutral">aguarda</span>
                  </div>
                }
              </section>
            }

            <section class="px-4">
              <app-section-band label="CONCLUÍDOS" [meta]="resultsMeta()" />
              <div class="flex flex-col gap-3">
                @for (result of store.results(); track result.match.id) {
                  <app-blueprint>
                    <p
                      class="flex items-center gap-2 border-b border-hairline px-3 py-2 text-[12px] muted"
                    >
                      {{ result.phaseLabel.toUpperCase() }} · {{ time(result.match.playedAt) }}
                      @if (result.reportedByName) {
                        <span class="flex items-center gap-1">
                          <app-icon name="lock" [size]="12" />
                          {{ result.reportedByName }}
                        </span>
                      }
                    </p>
                    <div class="flex items-baseline gap-2 px-3 py-2">
                      <span class="flex-1 font-heading text-[17px] font-semibold uppercase">{{
                        result.winnerLabel
                      }}</span>
                      @if (result.winnerConsequence) {
                        <span class="tag tag-accent">{{ result.winnerConsequence }}</span>
                      }
                      <span class="font-heading text-[24px] font-semibold tnum">{{
                        result.winnerScore
                      }}</span>
                    </div>
                    <div class="flex items-baseline gap-2 px-3 pb-2 muted">
                      <span class="flex-1 font-heading text-[17px] font-semibold uppercase">{{
                        result.loserLabel
                      }}</span>
                      @if (result.loserConsequence) {
                        <span class="tag tag-neutral">{{ result.loserConsequence }}</span>
                      }
                      <span class="font-heading text-[24px] font-semibold tnum">{{
                        result.loserScore
                      }}</span>
                    </div>
                    @if (result.correctedByName; as corrector) {
                      <p class="px-3 pb-2 text-[12px] muted">Corrigido por {{ corrector }}</p>
                    }
                    @if (group.canPlay() && store.correctionOpen()) {
                      <button
                        type="button"
                        class="flex items-center gap-1 px-3 pb-2 text-[13px] text-accent-700"
                        (click)="correct(result.match.id)"
                      >
                        <app-icon name="pencil" [size]="14" />
                        Corrigir
                      </button>
                    }
                  </app-blueprint>
                } @empty {
                  <p class="text-[14px] muted">Nenhuma partida concluída ainda.</p>
                }
              </div>
            </section>

            @if (placementEvent(); as event) {
              <div class="px-4">
                <app-inline-note tone="event" icon="hand">{{ event }}</app-inline-note>
              </div>
            }
          </div>
        }

        @case ('bracket') {
          <div class="flex flex-col gap-4 px-4 py-4 pb-6">
            @if (myTeamNote(); as note) {
              <app-inline-note tone="positive">{{ note }}</app-inline-note>
            }

            @if (encaixeNote(); as note) {
              <div class="border border-dashed border-neutral-500 p-3">
                <p class="flex items-center gap-2 kicker">
                  <app-icon name="git-merge" [size]="16" />
                  ENCAIXE
                </p>
                <p class="mt-1 text-[14px]">{{ note }}</p>
              </div>
            }

            <section>
              <app-section-band label="ESCADA ATÉ A FINAL" [meta]="progressMeta()" />
              <app-ladder [steps]="store.ladder()" [championLabel]="championLabel()" />
            </section>

            @if (outNote(); as note) {
              <p class="text-[13px] muted">{{ note }}</p>
            }
          </div>
        }

        @case ('teams') {
          <ul class="list-none p-0 pb-6">
            @for (row of teamRows(); track row.teamId) {
              <li class="row-rule flex items-center gap-3 px-4 py-3">
                <span class="flex-1 font-heading text-[17px] font-semibold uppercase">{{
                  row.label
                }}</span>
                <span class="tag" [class]="row.tagClass">{{ row.state }}</span>
              </li>
            }
          </ul>
        }
      }
    }

    <!--
      O respiro do convite flutuante: sem ele, o botão come a última fila da
      lista quando a rolagem chega ao fim (ticket 37).
    -->
    @if (invite()) {
      <div class="h-16" aria-hidden="true"></div>
    }

    @if (group.canPlay()) {
      <app-floating-invite
        [label]="invite()?.label ?? null"
        [hint]="invite()?.hint ?? null"
        dismissLabel="Descartar o convite de sortear o próximo"
        (act)="drawNext()"
        (dismissed)="dismissInvite()"
      />
    }

    @if (scoreTarget(); as bracket) {
      <app-score-sheet [bracket]="bracket" [correcting]="correcting()" (closed)="closeScore()" />
    }

    @if (group.canPlay() && store.tiebreak()) {
      <app-tiebreak-sheet
        [registering]="registering()"
        [note]="correctionNote()"
        (choose)="resolveTiebreak($event)"
      />
    } @else if (group.canPlay() && store.placementCandidate()) {
      <app-placement-sheet [registering]="registering()" (choose)="applyPlacement($event)" />
    }
  `,
  host: { class: 'block' },
})
export class TournamentLiveComponent implements OnInit {
  private readonly router = inject(Router);
  protected readonly group = inject(CurrentGroupStore);
  protected readonly store = inject(LiveTournamentStore);
  private readonly sessions = inject(SessionStore);

  readonly tournamentId = input.required<string>();
  /**
   * `?partidas=1`: vim corrigir um placar, não ver a classificação.
   *
   * Chega por `withComponentInputBinding`, que liga parâmetros de consulta a
   * entradas do componente.
   */
  readonly partidas = input<string | undefined>(undefined);

  private readonly verPartidas = computed(() => this.partidas() !== undefined);

  protected readonly tab = signal<Tab>('queue');
  protected readonly scoreTarget = signal<BracketMatch | null>(null);
  protected readonly correcting = signal<Match | null>(null);
  /** Descartado não volta neste campeonato (ticket 37). */
  protected readonly inviteDismissed = signal(false);
  /** Quem está sendo gravado como vencedor do par-ou-ímpar (encaixe ou empate). */
  protected readonly registering = signal<string | null>(null);

  /**
   * O que a última correção de placar derrubou, em uma frase.
   *
   * Três coisas podem cair, e cada uma precisa ser dita com o nome dela: o
   * par-ou-ímpar do empate, o do encaixe, e as partidas que deixaram de
   * acontecer. Juntar tudo num "algumas coisas mudaram" devolveria a chave
   * pausada sem explicação, que é exatamente o que o ticket 35 proíbe.
   */
  protected readonly correctionNote = computed(() => {
    const fallout = this.store.correctionFallout();
    if (!fallout) {
      return null;
    }

    const partes: string[] = [];
    const dropped = fallout.droppedDecisions;

    if (dropped.length === 1) {
      const duplas = dropped[0].teamIds.map((teamId) => this.store.teamLabel(teamId)).join(' × ');
      partes.push(`desfez o par-ou-ímpar de ${duplas} — o empate agora é entre outras duplas`);
    } else if (dropped.length > 1) {
      partes.push('desfez os par-ou-ímpares dos empates — eles agora são entre outras duplas');
    }

    if (fallout.droppedPlacement) {
      partes.push('desfez o encaixe: quem perdeu por menos já não é a mesma dupla');
    }

    if (fallout.removedMatches === 1) {
      partes.push('apagou 1 partida que já não acontece');
    } else if (fallout.removedMatches > 1) {
      partes.push(`apagou ${fallout.removedMatches} partidas que já não acontecem`);
    }

    return partes.length > 0 ? `A correção ${partes.join('; ')}.` : null;
  });

  protected readonly tabs = [
    { id: 'queue', label: 'Fila' },
    { id: 'bracket', label: 'Chave' },
    { id: 'teams', label: 'Duplas' },
  ];

  protected readonly context = computed(() => {
    const status = this.store.tournament()?.status === 'completed' ? 'FINALIZADO' : 'AO VIVO';
    return `CAMPEONATO · ${status}`;
  });

  /** A partida de agora só existe se a chave não está pausada. */
  protected readonly current = computed(() =>
    this.store.paused() ? null : this.store.currentMatch(),
  );

  protected readonly currentPhase = computed(() => {
    const bracket = this.current();
    return bracket ? this.phaseOf(bracket) : '';
  });

  protected readonly currentSides = computed(() => {
    const bracket = this.current();
    if (!bracket) {
      return [];
    }

    return [bracket.teamAId, bracket.teamBId].map((teamId) => ({
      teamId,
      label: this.store.teamLabel(teamId),
      note: this.noteFor(teamId),
    }));
  });

  /** Qualquer jogador lança qualquer partida que ainda não tenha placar. */
  protected readonly canReport = computed(() => {
    const bracket = this.current();
    if (!bracket || this.store.findSavedMatch(bracket)) {
      return false;
    }
    // Qualquer jogador lança qualquer partida: o dono pode estar em quadra.
    return this.group.canPlay();
  });

  protected readonly upcoming = computed(() => this.store.pending().slice(1));

  protected readonly resultsMeta = computed(() => {
    const tournament = this.store.tournament();
    if (!tournament) {
      return null;
    }
    return `${tournament.pointLimit} pts · ${tournament.thirdPlaceEnabled ? 'com' : 'sem'} 3º lugar`;
  });

  protected readonly progressMeta = computed(() => {
    const played = this.store.completedMatches().length;
    const total = this.store.ladder().length;
    return `${played} de ${total} jogos`;
  });

  protected readonly championLabel = computed(() => {
    const tournament = this.store.tournament();
    const champion = tournament?.finalStandings.find((standing) => standing.position === 1);
    return champion ? this.store.teamLabel(champion.teamId) : null;
  });

  protected readonly pausedLabel = computed(() => {
    const tiebreak = this.store.tiebreak();
    if (tiebreak) {
      return `DESEMPATE: ${tiebreak.teamIds.map((id) => this.store.teamLabel(id)).join(' × ')}`;
    }

    const candidate = this.store.placementCandidate();
    if (candidate) {
      const names = candidate.playerIds.map((id) => this.store.playerName(id) ?? '?');
      return `PAR-OU-ÍMPAR NA QUADRA: ${names.join(' × ').toUpperCase()}`;
    }

    return '';
  });

  /** A nota de quem joga: com quem está e quantas vitórias faltam. */
  protected readonly myTeamNote = computed(() => {
    const team = this.store.myTeam();
    if (!team) {
      return null;
    }

    const partnerId = team.playerIds.find((playerId) => playerId !== this.group.playerId());
    const partner = this.store.playerName(partnerId ?? null);
    const remaining = this.store.ladder().filter((step) => step.state !== 'done').length;

    if (remaining === 0) {
      return `Você está com ${partner}. Acabou.`;
    }

    const faltam = remaining === 1 ? 'Falta 1 vitória' : `Faltam ${remaining} vitórias`;
    return `Você está com ${partner}. ${faltam} para o título.`;
  });

  protected readonly encaixeNote = computed(() => {
    const tournament = this.store.tournament();
    const placement = tournament?.oddPlayerPlacement;
    if (!placement) {
      return null;
    }

    const surviving = this.store.playerName(placement.survivingPlayerId);
    const eliminated = this.store.playerName(placement.eliminatedPlayerId);
    const waiting = this.store.playerName(tournament?.waitingPlayerId ?? null);

    return `${this.store.teamLabel(placement.encaixeTeamId)} · ${surviving} venceu o par-ou-ímpar · ${waiting} era a avulsa · ${eliminated} fora`;
  });

  protected readonly outNote = computed(() => {
    const tournament = this.store.tournament();
    if (!tournament) {
      return null;
    }

    const parts = tournament.teams
      .filter((team) => team.eliminatedDirectly)
      .map((team) => `${this.store.teamLabel(team.id)} (eliminação direta)`);

    const placement = tournament.oddPlayerPlacement;
    if (placement) {
      parts.push(`${this.store.playerName(placement.eliminatedPlayerId)} (par-ou-ímpar)`);
    }

    return parts.length > 0 ? `Fora: ${parts.join(' · ')}.` : null;
  });

  protected readonly placementEvent = computed(() => {
    const tournament = this.store.tournament();
    const placement = tournament?.oddPlayerPlacement;
    if (!placement?.decidedAt) {
      return null;
    }

    const surviving = this.store.playerName(placement.survivingPlayerId);
    const eliminated = this.store.playerName(placement.eliminatedPlayerId);
    const waiting = this.store.playerName(tournament?.waitingPlayerId ?? null);
    const decidedBy = this.store.playerName(placement.decidedBy);

    return `Par-ou-ímpar: ${surviving} venceu e joga com ${waiting}. ${eliminated} está fora e entra com prioridade no próximo sorteio.${decidedBy ? ` Decidido por ${decidedBy} · ${formatTime(placement.decidedAt)}` : ''}`;
  });

  /** A aba Duplas: o estado de cada dupla do campeonato. */
  protected readonly teamRows = computed(() => {
    const tournament = this.store.tournament();
    if (!tournament) {
      return [];
    }

    const placement = tournament.oddPlayerPlacement;
    // O estado vem das PARTIDAS, não da marca guardada: `eliminated` só é
    // escrito na eliminação direta e na dupla desfeita pelo encaixe, então
    // perder um jogo não marcava nada e a aba dizia "em jogo" para a campeã.
    const estados = teamStates(tournament.teams, this.store.matches(), placement);

    const rotulos: Record<TeamState, { state: string; tagClass: string }> = {
      campea: { state: 'campeã', tagClass: 'tag-accent' },
      vice: { state: 'vice', tagClass: 'tag-neutral' },
      // A informação mais dura da tela: sair antes de jogar de novo.
      'eliminada-direto': { state: 'eliminada direto', tagClass: 'tag-danger' },
      desfeita: { state: 'desfeita no encaixe', tagClass: 'tag-neutral' },
      fora: { state: 'fora', tagClass: 'tag-neutral' },
      'em-jogo': { state: 'em jogo', tagClass: 'tag-accent' },
    };

    return tournament.teams.map((team) => {
      const rotulo =
        team.id === placement?.encaixeTeamId
          ? { state: 'encaixe', tagClass: 'tag-accent' }
          : rotulos[estados.get(team.id) ?? 'em-jogo'];

      return {
        teamId: team.id,
        label: this.store.teamLabel(team.id),
        state: rotulo.state,
        tagClass: rotulo.tagClass,
      };
    });
  });

  /**
   * O convite de sortear o próximo: aparece quando as prioridades congelam, e
   * some se a condição deixar de valer (tickets 36 e 37).
   *
   * Dois estados, um lugar: com um sorteio pendente ele já não convida a
   * sortear, e diz que o próximo está pronto.
   */
  protected readonly invite = computed<{ label: string; hint: string | null } | null>(() => {
    if (!this.group.canPlay() || this.inviteDismissed()) {
      return null;
    }

    const tournament = this.store.tournament();
    if (!tournament || tournament.status === 'completed' || !this.store.priorityFrozen()) {
      return null;
    }

    return this.sessions.pendingDraw()
      ? { label: 'O PRÓXIMO JÁ ESTÁ SORTEADO', hint: 'toque para sortear de novo' }
      : { label: 'JÁ DÁ PARA SORTEAR O PRÓXIMO', hint: null };
  });

  async ngOnInit(): Promise<void> {
    await this.store.load(this.tournamentId());

    const sessionId = this.store.tournament()?.sessionId;
    if (sessionId) {
      await this.sessions.loadById(sessionId);
    }

    this.inviteDismissed.set(readDismissed(this.tournamentId()));

    // Campeonato que já terminou abre na classificação — a menos que a pessoa
    // tenha vindo justamente para corrigir um placar (`?partidas=1`).
    if (this.store.tournament()?.status === 'completed' && !this.verPartidas()) {
      void this.router.navigate([
        '/g',
        this.group.groupId(),
        'campeonatos',
        this.tournamentId(),
        'classificacao',
      ]);
    }
  }

  protected phaseOf(bracket: BracketMatch): string {
    return this.store.ladder().find((step) => step.phase === bracket.phase)?.phaseLabel ?? '';
  }

  protected time(iso: string): string {
    return formatTime(iso);
  }

  protected noteFor(teamId: string): string | null {
    return (
      this.store
        .ladder()
        .flatMap((step) => [step.a, step.b])
        .find((side) => side.teamId === teamId)?.note ?? null
    );
  }

  protected openScore(bracket: BracketMatch): void {
    this.correcting.set(null);
    this.scoreTarget.set(bracket);
  }

  protected async closeScore(): Promise<void> {
    this.scoreTarget.set(null);
    this.correcting.set(null);
    await this.store.reload();

    if (this.store.tournament()?.status === 'completed' && !this.verPartidas()) {
      void this.router.navigate([
        '/g',
        this.group.groupId(),
        'campeonatos',
        this.tournamentId(),
        'classificacao',
      ]);
    }
  }

  /** Corrigir é reabrir o placar da partida; qualquer jogador pode. */
  protected correct(matchId: string): void {
    const match = this.store.matches().find((candidate) => candidate.id === matchId);
    if (!match) {
      return;
    }
    this.correcting.set(match);
    this.scoreTarget.set({
      phase: match.phase,
      teamAId: match.teamAId,
      teamBId: match.teamBId,
    });
  }

  protected async applyPlacement(survivingPlayerId: string): Promise<void> {
    await this.register(survivingPlayerId, () => this.store.applyPlacement(survivingPlayerId));
  }

  protected async resolveTiebreak(winnerTeamId: string): Promise<void> {
    await this.register(winnerTeamId, () => this.store.resolveTiebreak(winnerTeamId));
  }

  /**
   * Registrar uma decisão de quadra: o botão tocado mostra que está gravando, e
   * os outros fecham.
   *
   * Decisão de par-ou-ímpar é gesto de beira de quadra, com o celular passando
   * de mão em mão — e o banco a uns segundos de distância. Sem travar, o toque
   * repetido registraria duas.
   */
  private async register(id: string, action: () => Promise<void>): Promise<void> {
    if (this.registering() !== null) {
      return;
    }

    this.registering.set(id);
    try {
      await action();
    } finally {
      this.registering.set(null);
    }
  }

  /**
   * Descartar não insiste: um botão que reaparece a cada rolagem é um anúncio.
   * Vale só para este campeonato, e só nesta aba — o próximo campeonato
   * convida de novo.
   */
  protected dismissInvite(): void {
    this.inviteDismissed.set(true);
    writeDismissed(this.tournamentId());
  }

  /**
   * Vai para o sorteio de sempre — as mesmas três propostas, a mesma troca por
   * toque. O `?voltarPara=` é o que traz de volta para cá: a final ainda
   * precisa de placar (ticket 36).
   */
  protected drawNext(): void {
    const sessionId = this.store.tournament()?.sessionId;
    if (!sessionId) {
      return;
    }

    void this.router.navigate(
      ['/g', this.group.groupId(), 'campeonatos', 'sessoes', sessionId, 'sorteio'],
      { queryParams: { voltarPara: this.tournamentId() } },
    );
  }

  protected back(): void {
    void this.router.navigate(['/g', this.group.groupId(), 'campeonatos']);
  }
}
