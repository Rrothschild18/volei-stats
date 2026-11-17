import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { BracketMatch } from '../../../core/services/tournament.service';
import { CorrectionRefusal, LiveTournamentStore } from '../../../core/stores/live-tournament.store';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import { phaseLabel } from '../../../core/rules/bracket-phases';
import { expectedStop, readFinalScore, scoreCeiling } from '../../../core/rules/final-score';
import { CORRECTION_WINDOW_LABEL } from '../../../core/rules/tournament-timing';
import { Match } from '../../../shared/models';
import { MatchOpening, quemAbreSacando } from '../../../core/rules/match-opening';
import { ralisDoPlacar, sacadorAtual } from '../../../core/rules/serve-tracker';
import { ScoreDraftService } from '../../../core/services/score-draft.service';
import { INICIO_VAZIO, MatchOpeningComponent } from './match-opening.component';
import { MatchupSliderComponent } from './matchup-slider.component';
import { formatTime } from '../../../shared/utils/date.util';
import {
  ActionBarComponent,
  BusyDirective,
  FocusTrapDirective,
  BlueprintComponent,
  IconComponent,
  InlineNoteComponent,
  StepperComponent,
} from '../../../shared/ui';

/**
 * Lançar placar (1n/1o/1p).
 *
 * Quem está na partida pode lançar, e **o primeiro placar salvo trava**: a
 * correção depois é de qualquer jogador. Empate e 0 × 0 não salvam; abaixo do limite, o
 * app pede confirmação em vez de recusar.
 */
@Component({
  selector: 'app-score-sheet',
  imports: [
    ActionBarComponent,
    BlueprintComponent,
    BusyDirective,
    FocusTrapDirective,
    IconComponent,
    InlineNoteComponent,
    MatchOpeningComponent,
    MatchupSliderComponent,
    StepperComponent,
  ],
  template: `
    <div
      class="fixed inset-0 z-40 mx-auto flex max-w-[480px] flex-col bg-bg"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="sheetTitle()"
      appFocusTrap
      (escape)="closed.emit()"
    >
      <header class="flex items-start justify-between gap-2 px-4 pt-4 pb-3">
        <div>
          <p class="kicker">{{ kicker() }}</p>
          <h2 class="title-lg mt-1">{{ sheetTitle() }}</h2>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-icon border-0"
          aria-label="Fechar"
          (click)="closed.emit()"
        >
          <app-icon name="x" [size]="24" />
        </button>
      </header>

      <div class="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
        @if (saved(); as savedMatch) {
          <app-blueprint>
            <p class="flex items-center gap-2 border-b border-hairline px-3 py-2 text-[12px] muted">
              <app-icon name="lock" [size]="14" />
              TRAVADO · lançado por {{ reporterLabel() }} às {{ time(savedMatch.playedAt) }}
            </p>
            @for (row of savedRows(); track row.label) {
              <div class="flex items-baseline gap-2 px-3 py-3" [class.muted]="!row.won">
                <span
                  class="flex-1 font-heading text-[26px] leading-none font-semibold uppercase"
                  >{{ row.label }}</span
                >
                <span class="font-heading text-[44px] leading-none font-semibold tnum">{{
                  row.score
                }}</span>
              </div>
            }
          </app-blueprint>

          @if (correctorLabel(); as corrector) {
            <p class="text-[14px] muted">Corrigido por {{ corrector }}.</p>
          }

          <!-- O que foi registrado no início do jogo. Some quando ninguém registrou. -->
          @if (openingLabel(); as inicio) {
            <p class="text-[14px] muted">{{ inicio }}</p>
          }

          <p class="text-[14px]">
            Errou algum número?
            <strong class="font-semibold">Qualquer jogador do vôlei corrige</strong> — e fica
            registrado quem foi.
          </p>
        } @else {
          @if (!correcting()) {
            <app-inline-note tone="event" icon="lock">
              <strong class="font-semibold">O primeiro placar salvo trava.</strong> Depois dele,
              qualquer jogador corrige — e quem corrigir fica registrado na partida.
            </app-inline-note>
          }

          @if (!correcting()) {
            <app-match-opening
              [teamAId]="bracket().teamAId"
              [teamBId]="bracket().teamBId"
              [teamALabel]="store.teamLabel(bracket().teamAId)"
              [teamBLabel]="store.teamLabel(bracket().teamBId)"
              [playersOfTeam]="playersOfTeam"
              [opening]="opening()"
              (openingChange)="aoMudarInicio($event)"
            />
          }

          @for (side of sides(); track side.teamId) {
            <app-blueprint [selected]="side.winning">
              <div class="flex flex-col gap-2 p-3">
                <span class="flex items-center justify-between gap-2">
                  <span class="kicker">{{ side.origin }}</span>
                  @if (side.winning) {
                    <span class="text-[12px] font-semibold text-accent-700">vence</span>
                  }
                </span>
                <span class="font-heading text-[26px] leading-none font-semibold uppercase">{{
                  side.label
                }}</span>

                <!--
                  A bola: de quem é o saque agora. Ela anda sozinha a cada
                  toque no +, pela regra da quadra. Tocar nela troca o sacador
                  dentro da dupla; sem ninguém sacando, cada dupla oferece
                  "marcar o saque".
                -->
                @if (!correcting()) {
                  @if (side.sacador; as nome) {
                    <button
                      type="button"
                      class="flex min-h-9 items-center gap-2 self-start bg-accent-100 px-2 text-[14px] font-semibold text-accent-800"
                      [attr.aria-label]="
                        'Saque com ' + nome + '. Toque para trocar o sacador da dupla.'
                      "
                      (click)="trocarSacador(side.teamId)"
                    >
                      <app-icon name="volleyball" [size]="18" />
                      SACA {{ nome }}
                    </button>
                  } @else if (!sacador()) {
                    <button
                      type="button"
                      class="flex min-h-9 items-center gap-2 self-start text-[13px] text-accent-700"
                      (click)="marcarSaque(side.teamId)"
                    >
                      <app-icon name="volleyball" [size]="16" />
                      marcar o saque aqui
                    </button>
                  }
                }

                @if (side.teamId === bracket().teamAId) {
                  <app-stepper
                    label="pontos da primeira dupla"
                    [value]="scoreA()"
                    (valueChange)="pontuar(side.teamId, $event)"
                    [max]="maxA()"
                    [large]="true"
                  />
                } @else {
                  <app-stepper
                    label="pontos da segunda dupla"
                    [value]="scoreB()"
                    (valueChange)="pontuar(side.teamId, $event)"
                    [max]="maxB()"
                    [large]="true"
                  />
                }
              </div>
            </app-blueprint>
          }

          <div aria-live="polite">
            @if (refusalMessage(); as message) {
              <app-inline-note tone="error">{{ message }}</app-inline-note>
            }
          </div>

          @if (error(); as message) {
            <app-inline-note tone="error">{{ message }}</app-inline-note>
          } @else if (preview(); as message) {
            <app-inline-note tone="positive">{{ message }}</app-inline-note>
          }

          <!--
            Aqui ficavam o aviso de 0 × 0 e a frase do limite: dois textos que
            diziam o que a tela já faz (o SALVAR nasce desligado, e o + para no
            teto da regra). O lugar ficou para o histórico das duplas.
          -->
          @if (!correcting()) {
            <app-matchup-slider
              [teamA]="jogadoresDe(bracket().teamAId)"
              [teamB]="jogadoresDe(bracket().teamBId)"
              [teamALabel]="store.teamLabel(bracket().teamAId)"
              [teamBLabel]="store.teamLabel(bracket().teamBId)"
              [nameOf]="nomeDe"
            />
          }
        }
      </div>

      @if (!saved()) {
        <app-action-bar>
          <button
            type="button"
            class="btn btn-primary blueprint h-14 text-[17px]"
            [appBusy]="busy()"
            [disabled]="!salvavel() || busy()"
            (click)="save()"
          >
            <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i>
            <i class="corner br"></i>
            {{ correcting() ? 'CORRIGIR' : 'SALVAR' }} {{ scoreA() }} × {{ scoreB() }}
          </button>
        </app-action-bar>
      } @else {
        <!--
          Uma ação só. O NO ZAP saiu daqui: fim de jogo é hora de ver a chave, e
          o que vai para o grupo é o resumo da noite, pela sessão.
        -->
        <app-action-bar>
          <button
            type="button"
            class="btn btn-primary blueprint h-14 text-[17px]"
            (click)="closed.emit()"
          >
            <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i>
            <i class="corner br"></i>
            VER CHAVE
          </button>
        </app-action-bar>
      }
    </div>

    @if (confirming()) {
      <div class="dialog-backdrop items-center">
        <app-blueprint class="dialog" role="dialog" aria-modal="true" aria-label="Confirmar placar">
          <h3 class="font-heading text-[20px] font-semibold uppercase">Jogo parou antes</h3>
          <p class="text-[14px]">
            O vencedor fez {{ maxScore() }}, e o limite é {{ pointLimit() }}. Se o jogo foi
            interrompido — acabou o horário, começou a chover — salve assim mesmo.
          </p>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="btn btn-secondary" (click)="confirming.set(false)">
              VOLTAR
            </button>
            <button
              type="button"
              class="btn btn-primary"
              [appBusy]="busy()"
              [disabled]="busy()"
              (click)="commit()"
            >
              SALVAR
            </button>
          </div>
        </app-blueprint>
      </div>
    }
  `,
})
export class ScoreSheetComponent {
  protected readonly store = inject(LiveTournamentStore);
  private readonly group = inject(CurrentGroupStore);

  readonly bracket = input.required<BracketMatch>();
  /** Partida já lançada que está sendo corrigida. */
  readonly correcting = input<Match | null>(null);
  readonly closed = output<void>();

  protected readonly scoreA = signal(0);
  protected readonly scoreB = signal(0);
  protected readonly busy = signal(false);
  protected readonly refusal = signal<CorrectionRefusal | null>(null);
  /** O início do jogo (ticket 07). Vazio é o normal: o registro é opcional. */
  protected readonly opening = signal<MatchOpening>(INICIO_VAZIO);

  protected readonly rascunho = inject(ScoreDraftService);

  /**
   * A dupla que ganhou cada rali, desde o 0 × 0 — é o que vai para o banco.
   * Nulo quando a ordem se perdeu (alguém pulou mais de um ponto de uma vez).
   */
  protected readonly ralis = signal<readonly string[] | null>([]);

  /**
   * De onde a bola está sendo acompanhada: a dupla que sacava naquele momento
   * e os ralis desde então. Separado de `ralis` porque dá para marcar o saque
   * no meio do jogo, sem ter contado desde o início.
   */
  private readonly saque = signal<{ teamId: string; rallies: readonly string[] } | null>(null);

  /** Quem saca primeiro em cada dupla, quando a quadra trocou o padrão. */
  private readonly primeiros = signal<Readonly<Record<string, string>>>({});

  /** De quem é o saque agora, ou nulo se ninguém sabe. */
  protected readonly sacador = computed(() => {
    const saque = this.saque();
    return saque
      ? sacadorAtual({
          firstServerTeamId: saque.teamId,
          playersOfTeam: (teamId) => this.jogadoresDe(teamId),
          firstServerOf: this.primeiros(),
          rallies: saque.rallies,
        })
      : null;
  });

  protected readonly jogadoresDe = (teamId: string): readonly string[] =>
    this.store.team(teamId)?.playerIds ?? [];

  protected readonly nomeDe = (playerId: string): string =>
    (this.store.playerName(playerId) ?? '?').toUpperCase();

  /** Os dois jogadores de uma dupla, para a pergunta de quem chamou. */
  protected readonly playersOfTeam = (teamId: string) =>
    (this.store.team(teamId)?.playerIds ?? []).map((playerId) => ({
      id: playerId,
      name: this.store.playerName(playerId) ?? '?',
    }));

  protected readonly refusalMessage = computed(() => {
    switch (this.refusal()) {
      case 'window-closed':
        return `Este campeonato fechou. Placar só até ${CORRECTION_WINDOW_LABEL} depois do fim.`;
      case 'not-found':
        return 'Esta partida não existe mais.';
      default:
        return null;
    }
  });
  protected readonly confirming = signal(false);
  /** Preenchido depois de salvar: a tela vira "placar travado". */
  protected readonly saved = signal<Match | null>(null);

  /** O início do jogo da partida salva, em uma frase. */
  protected readonly openingLabel = computed(() => {
    const match = this.saved();
    if (!match) {
      return null;
    }

    const partes: string[] = [];

    if (match.coinWinnerTeamId && match.coinChoice) {
      const chamou = this.store.playerName(match.coinCallerPlayerId);
      const quem = chamou
        ? `${this.store.teamLabel(match.coinWinnerTeamId)} (${chamou})`
        : this.store.teamLabel(match.coinWinnerTeamId);
      partes.push(`Par-ou-ímpar: ${quem} escolheu ${match.coinChoice}`);
    }

    if (match.firstServerTeamId) {
      partes.push(`abriu sacando ${this.store.teamLabel(match.firstServerTeamId)}`);
    }

    if (match.teamASide) {
      partes.push(`${this.store.teamLabel(match.teamAId)} à ${match.teamASide}`);
    }

    return partes.length > 0 ? `${partes.join(' · ')}.` : null;
  });

  protected readonly pointLimit = computed(() => this.store.tournament()?.pointLimit ?? 12);

  protected readonly sheetTitle = computed(() => {
    if (this.saved()) {
      return 'PLACAR SALVO';
    }
    return this.correcting() ? 'CORRIGIR PLACAR' : 'PLACAR FINAL';
  });

  /** O rascunho deste jogo já foi lido: só depois disso a folha passa a gravar. */
  private readonly restaurado = signal(false);

  constructor() {
    // Corrigir parte do placar que está lá, não do zero.
    effect(() => {
      const match = this.correcting();
      if (match) {
        this.scoreA.set(match.scoreA);
        this.scoreB.set(match.scoreB);
      }
    });

    // Reabrir a folha devolve a contagem de onde parou. Correção não tem
    // rascunho: ela parte do placar salvo, que é a verdade do grupo.
    effect(() => {
      const bracket = this.bracket();
      if (this.correcting() || untracked(() => this.restaurado())) {
        return;
      }

      const guardado = this.rascunho.ler(bracket);
      untracked(() => {
        if (guardado) {
          this.scoreA.set(guardado.scoreA);
          this.scoreB.set(guardado.scoreB);
          this.ralis.set(guardado.ralis);
          this.saque.set(guardado.saque);
          this.primeiros.set(guardado.primeiros ?? {});
          this.opening.set(guardado.opening ?? INICIO_VAZIO);
        }
        this.restaurado.set(true);
      });
    });

    effect(() => {
      const atual = {
        scoreA: this.scoreA(),
        scoreB: this.scoreB(),
        ralis: this.ralis(),
        saque: this.saque(),
        primeiros: this.primeiros(),
        opening: this.opening(),
      };

      if (!this.restaurado() || this.correcting() || this.saved()) {
        return;
      }

      const bracket = untracked(() => this.bracket());
      const vazio =
        atual.scoreA + atual.scoreB === 0 &&
        !atual.saque &&
        !atual.opening.coinWinnerTeamId &&
        !atual.opening.teamASide;

      // Folha aberta e fechada sem nada: não há rascunho para guardar, e deixar
      // um de 0 × 0 por partida só encheria o armazenamento do aparelho.
      if (vazio) {
        this.rascunho.apagar(bracket);
      } else {
        this.rascunho.guardar(bracket, atual);
      }
    });
  }

  /**
   * Um toque no + ou no −. Cada + é um rali ganho por aquela dupla, e é dele
   * que a bola anda: quem sacava e pontuou continua; pontuou o outro lado, a
   * posse passa.
   */
  protected pontuar(teamId: string, valor: number): void {
    const bracket = this.bracket();
    const eA = teamId === bracket.teamAId;
    const antes = eA ? this.scoreA() : this.scoreB();
    const mudanca = { teamId, antes, depois: valor };

    (eA ? this.scoreA : this.scoreB).set(valor);
    this.ralis.update((ralis) => ralisDoPlacar(ralis, mudanca));
    this.saque.update((saque) => {
      if (!saque) {
        return null;
      }
      const rallies = ralisDoPlacar(saque.rallies, mudanca);
      // A ordem se perdeu: melhor apagar a bola do que apontar o sacador errado.
      return rallies ? { ...saque, rallies } : null;
    });
  }

  /** "O saque está com esta dupla agora" — dá para começar a acompanhar no meio do jogo. */
  protected marcarSaque(teamId: string): void {
    this.saque.set({ teamId, rallies: [] });
  }

  /** Dentro da dupla, quem está sacando é o outro. */
  protected trocarSacador(teamId: string): void {
    const jogadores = this.jogadoresDe(teamId);
    const primeiro = this.primeiros()[teamId] ?? jogadores[0];
    const outro = jogadores.find((playerId) => playerId !== primeiro);
    if (outro) {
      this.primeiros.update((atual) => ({ ...atual, [teamId]: outro }));
    }
  }

  /**
   * O par-ou-ímpar diz quem abre sacando. Enquanto a sequência de ralis é
   * conhecida desde o 0 × 0, isso basta para pôr a bola no lugar — mesmo se o
   * início for registrado com o jogo já andando.
   */
  protected aoMudarInicio(opening: MatchOpening): void {
    this.opening.set(opening);

    const bracket = this.bracket();
    const abre = quemAbreSacando({
      coinWinnerTeamId: opening.coinWinnerTeamId,
      coinChoice: opening.coinChoice,
      teamAId: bracket.teamAId,
      teamBId: bracket.teamBId,
    });
    const ralis = this.ralis();

    if (abre && ralis) {
      this.saque.set({ teamId: abre, rallies: ralis });
    }
  }

  protected readonly kicker = computed(
    () =>
      `${phaseLabel(this.bracket().phase).toUpperCase()} · ${this.store.tournament()?.name?.toUpperCase() ?? ''}`,
  );

  protected readonly maxScore = computed(() => Math.max(this.scoreA(), this.scoreB()));

  /** Até onde o `+` de cada lado sobe: a regra do jogo, não um número solto. */
  protected readonly maxA = computed(() => scoreCeiling(this.scoreB(), this.pointLimit()));
  protected readonly maxB = computed(() => scoreCeiling(this.scoreA(), this.pointLimit()));

  /** A leitura da regra: o mesmo veredito que a mensagem e o salvar usam. */
  protected readonly veredito = computed(() =>
    readFinalScore(this.scoreA(), this.scoreB(), this.pointLimit()),
  );

  protected readonly error = computed(() => {
    const limite = this.pointLimit();

    switch (this.veredito()) {
      // 0 × 0 não é erro: é como a folha abre. O SALVAR já nasce desligado
      // (`salvavel`), e dizer "ninguém jogou 0 × 0" era narrar o óbvio.
      case 'zero':
        return null;
      case 'tie':
        return 'Vôlei não tem empate. Ajuste o placar para salvar.';
      case 'needs-two':
        return `Em ${limite} o jogo não acaba por um ponto: vai até alguém abrir dois.`;
      case 'past-limit': {
        const [a, b] = expectedStop(this.scoreA(), this.scoreB(), limite);
        return `Com limite de ${limite}, o jogo teria parado em ${a} × ${b}.`;
      }
      default:
        return null;
    }
  });

  /** Dá para salvar: sem erro de regra, e com algum ponto na folha. */
  protected readonly salvavel = computed(() => !this.error() && this.veredito() !== 'zero');

  protected readonly sides = computed(() => {
    const bracket = this.bracket();
    const scoreA = this.scoreA();
    const scoreB = this.scoreB();
    const playerId = this.group.playerId();
    const sacador = this.sacador();

    return [bracket.teamAId, bracket.teamBId].map((teamId) => {
      const isA = teamId === bracket.teamAId;
      const score = isA ? scoreA : scoreB;
      const other = isA ? scoreB : scoreA;
      const mine = this.store.teamHas(teamId, playerId);

      return {
        teamId,
        label: this.store.teamLabel(teamId),
        origin: mine ? `VOCÊ · ${this.origin(teamId)}` : this.origin(teamId),
        winning: score > other,
        /** O nome de quem saca, quando o saque é desta dupla. */
        sacador:
          sacador?.teamId === teamId
            ? (this.store.playerName(sacador.playerId) ?? '?').toUpperCase()
            : null,
      };
    });
  });

  /** O que o resultado produz em seguida, dito em palavras. */
  protected readonly preview = computed(() => {
    if (!this.salvavel()) {
      return null;
    }

    const bracket = this.bracket();
    const winnerId = this.scoreA() > this.scoreB() ? bracket.teamAId : bracket.teamBId;
    const diff = Math.abs(this.scoreA() - this.scoreB());
    const winner = this.store.teamLabel(winnerId);

    const nextPhases = this.store
      .ladder()
      .filter((step) => step.state === 'later' || step.state === 'next');
    const nextPhase = nextPhases[0];

    if (!nextPhase) {
      return `${winner} vence por ${diff}.`;
    }

    return `${winner} vence por ${diff} e vai à ${nextPhase.phaseLabel.toLowerCase()}.`;
  });

  protected readonly savedRows = computed(() => {
    const match = this.saved();
    if (!match) {
      return [];
    }

    return [
      {
        label: this.store.teamLabel(match.teamAId),
        score: match.scoreA,
        won: match.winnerId === match.teamAId,
      },
      {
        label: this.store.teamLabel(match.teamBId),
        score: match.scoreB,
        won: match.winnerId === match.teamBId,
      },
    ].sort((a, b) => Number(b.won) - Number(a.won));
  });

  protected readonly reporterLabel = computed(() => {
    const match = this.saved();
    if (!match) {
      return '';
    }
    return match.reportedBy === this.group.playerId()
      ? 'você'
      : (this.store.playerName(match.reportedBy) ?? 'alguém');
  });

  /** Quem corrigiu, quando alguém corrigiu. Corrigir é de qualquer jogador. */
  protected readonly correctorLabel = computed(() => {
    const match = this.saved();
    if (!match?.correctedBy) {
      return null;
    }
    return match.correctedBy === this.group.playerId()
      ? 'você'
      : (this.store.playerName(match.correctedBy) ?? 'alguém');
  });

  protected time(iso: string): string {
    return formatTime(iso);
  }

  protected async save(): Promise<void> {
    if (!this.salvavel()) {
      return;
    }

    // Jogo interrompido é o único caso em que o placar não segue a regra e
    // ainda assim vale: quem estava na quadra confirma.
    if (this.veredito() === 'below-limit') {
      this.confirming.set(true);
      return;
    }

    await this.commit();
  }

  protected async commit(): Promise<void> {
    this.confirming.set(false);
    this.busy.set(true);
    try {
      const correcting = this.correcting();
      if (correcting) {
        // Correção é UPDATE, e fica registrado quem corrigiu.
        const result = await this.store.correctScore(
          correcting.id,
          this.scoreA(),
          this.scoreB(),
          this.group.playerId(),
        );

        // Recusada, a folha NÃO fecha: fechar devolveria a pessoa à chave com o
        // placar antigo e sem nada dito. O prazo é a recusa que ela vai ver —
        // a tela de onde ela veio já tinha escondido o botão, então chegar aqui
        // significa aba velha ou link antigo.
        if (!result.saved) {
          this.refusal.set(result.refusal);
          return;
        }

        this.closed.emit();
        return;
      }

      const result = await this.store.reportScore(
        this.bracket(),
        this.scoreA(),
        this.scoreB(),
        this.group.playerId(),
        this.opening(),
        this.ralis(),
      );

      // Salvou: o rascunho deste jogo não tem mais o que guardar.
      this.rascunho.apagar(this.bracket());

      // Outro aparelho chegou primeiro: mostra o placar que já está salvo.
      const match = result.existing ?? this.store.findSavedMatch(this.bracket());

      if (this.correcting() && result.saved) {
        this.closed.emit();
        return;
      }

      this.saved.set(match);
    } finally {
      this.busy.set(false);
    }
  }

  /** "DUPLA DO ENCAIXE", "BYE", "RODADA 1". */
  private origin(teamId: string): string {
    const tournament = this.store.tournament();
    if (tournament?.oddPlayerPlacement?.encaixeTeamId === teamId) {
      return 'DUPLA DO ENCAIXE';
    }

    const note = this.store
      .ladder()
      .flatMap((step) => [step.a, step.b])
      .find((side) => side.teamId === teamId)?.note;

    return note?.toUpperCase() ?? 'RODADA 1';
  }
}
