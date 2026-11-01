import { Injectable, computed, inject, signal } from '@angular/core';
import { AppFacade } from '../facade/app.facade';
import { BracketMatch, BracketSlot, TournamentService } from '../services/tournament.service';
import { DrawService } from '../services/draw.service';
import { CurrentGroupStore } from './current-group.store';
import { findFormat } from '../rules/tournament-formats';
import { phaseLabel, plannedPhases } from '../rules/bracket-phases';
import { readRound1 } from '../rules/round-1-outcome';
import { correctionWindowOpen, tournamentTiming } from '../rules/tournament-timing';
import {
  Match,
  MatchPhase,
  PendingTiebreak,
  Player,
  TiebreakDecision,
  Tournament,
  TournamentTeam,
} from '../../shared/models';

/** Estado de um degrau da escada. */
export type LadderState = 'done' | 'now' | 'next' | 'later';

export interface LadderSide {
  readonly teamId: string | null;
  readonly label: string;
  readonly note: string | null;
  readonly score: number | null;
  readonly isMine: boolean;
}

export interface LadderStep {
  readonly phase: MatchPhase;
  readonly phaseLabel: string;
  readonly state: LadderState;
  readonly a: LadderSide;
  readonly b: LadderSide;
}

export interface MatchResult {
  readonly match: Match;
  readonly phaseLabel: string;
  readonly winnerLabel: string;
  readonly loserLabel: string;
  readonly winnerScore: number;
  readonly loserScore: number;
  /** "+5 · direto à final" */
  readonly winnerConsequence: string | null;
  /** "−5 · fora" */
  readonly loserConsequence: string | null;
  readonly reportedByName: string | null;
  /** Preenchido quando alguém corrigiu o placar depois de salvo. */
  readonly correctedByName: string | null;
}

const UNDEFINED_SLOT = 'VENCEDOR';

/**
 * O que uma correção de placar levou embora.
 *
 * Existe para a tela poder **dizer**. Uma decisão de quadra desfeita em
 * silêncio volta como uma chave que pausou sem explicação, e ninguém liga uma
 * coisa à outra — alguém fez aquele par-ou-ímpar na beira da quadra.
 */
export interface CorrectionFallout {
  readonly droppedDecisions: readonly TiebreakDecision[];
  /** O par-ou-ímpar do encaixe caiu junto: a chave vai pedir outro. */
  readonly droppedPlacement: boolean;
  /** Quantas partidas de fases posteriores deixaram de acontecer. */
  readonly removedMatches: number;
}

const EMPTY_FALLOUT: CorrectionFallout = {
  droppedDecisions: [],
  droppedPlacement: false,
  removedMatches: 0,
};

function hasFallout(fallout: CorrectionFallout): boolean {
  return (
    fallout.droppedDecisions.length > 0 || fallout.droppedPlacement || fallout.removedMatches > 0
  );
}

/** Por que uma correção não foi gravada. */
export type CorrectionRefusal = 'not-found' | 'window-closed';

export type CorrectionResult =
  | { readonly saved: true; readonly fallout: CorrectionFallout }
  | { readonly saved: false; readonly refusal: CorrectionRefusal };

/** As prioridades do campeonato como texto comparável. */
function priorityKeys(tournament: Tournament): string {
  return (tournament.priorityEntries ?? [])
    .map((entry) => `${entry.playerId}:${entry.reason}`)
    .sort()
    .join(',');
}

/**
 * O campeonato que está rolando: a fila, a escada, o encaixe e o desempate.
 *
 * Tudo que a tela mostra é derivado das partidas salvas — a chave não guarda
 * estado próprio. Quando falta uma decisão de quadra, a chave fica pausada e
 * nenhuma partida nova é gerada (REGRAS.md §9.3).
 */
@Injectable({ providedIn: 'root' })
export class LiveTournamentStore {
  private readonly facade = inject(AppFacade);
  private readonly tournaments = inject(TournamentService);
  private readonly draws = inject(DrawService);
  private readonly group = inject(CurrentGroupStore);

  readonly tournament = signal<Tournament | null>(null);
  readonly matches = signal<readonly Match[]>([]);
  readonly pending = signal<readonly BracketMatch[]>([]);
  /**
   * As vagas da chave, incluindo as pela METADE — quem já se classificou e
   * espera adversário. A fila do que dá para jogar (`pending`) só tem vagas
   * inteiras; a escada desenha as duas coisas.
   */
  readonly slots = signal<readonly BracketSlot[]>([]);
  readonly players = signal<readonly Player[]>([]);
  readonly loading = signal(false);

  /**
   * O que a última correção derrubou, enquanto a tela não disser.
   *
   * Mora na store, e não numa saída do componente, porque quem precisa falar é
   * a tela da chave — e quem recebe o resultado é a folha de placar, dois
   * componentes acima dela.
   */
  readonly correctionFallout = signal<CorrectionFallout | null>(null);

  readonly playersById = computed(
    () => new Map(this.players().map((player) => [player.id, player])),
  );

  readonly format = computed(() => {
    const formatId = this.tournament()?.formatId;
    return formatId ? (findFormat(formatId) ?? null) : null;
  });

  readonly completedMatches = computed(() =>
    this.matches()
      .filter((match) => match.winnerId !== null)
      .sort((a, b) => a.playedAt.localeCompare(b.playedAt)),
  );

  /** A partida em quadra agora: a primeira da fila. */
  readonly currentMatch = computed(() => this.pending()[0] ?? null);

  /** Decisão de quadra pendente: o empate que pausa a chave. */
  readonly tiebreak = computed<PendingTiebreak | null>(() => {
    const tournament = this.tournament();
    return tournament ? this.tournaments.pendingTiebreak(tournament, [...this.matches()]) : null;
  });

  /** O par-ou-ímpar do encaixe, quando a rodada 1 fechou e ninguém decidiu. */
  readonly placementCandidate = computed(() => {
    const tournament = this.tournament();
    if (!tournament || this.tiebreak()) {
      return null;
    }
    if (!this.tournaments.needsOddPlayerPlacementDecision(tournament, [...this.matches()])) {
      return null;
    }
    return this.tournaments.getOddPlayerPlacementCandidate(tournament, [...this.matches()]);
  });

  readonly paused = computed(() => !!this.tiebreak() || !!this.placementCandidate());

  /**
   * As prioridades deste campeonato já estão decididas: o próximo sorteio pode
   * sair agora, enquanto a final rola (ticket 36).
   */
  readonly priorityFrozen = computed(() => {
    const tournament = this.tournament();
    return tournament ? this.tournaments.priorityFrozen(tournament, [...this.matches()]) : false;
  });

  /** A partida do usuário que ainda não tem placar. */
  readonly myMatch = computed(() => {
    const playerId = this.group.playerId();
    return (
      this.slots().find((slot) =>
        [slot.teamAId, slot.teamBId].some((teamId) => this.teamHas(teamId, playerId)),
      ) ?? null
    );
  });

  /** A dupla do usuário neste campeonato, se ele está jogando. */
  readonly myTeam = computed(() => {
    const playerId = this.group.playerId();
    const tournament = this.tournament();
    if (!tournament) {
      return null;
    }
    const alive = tournament.teams.filter((team) => !team.eliminated);
    return alive.find((team) => playerId !== null && team.playerIds.includes(playerId)) ?? null;
  });

  readonly ladder = computed<LadderStep[]>(() => this.buildLadder());

  /** As fases que o usuário ainda joga se vencer. */
  readonly myPath = computed(() =>
    this.ladder().filter((step) => step.state !== 'done' && (step.a.isMine || step.b.isMine)),
  );

  readonly results = computed<MatchResult[]>(() => this.buildResults());

  async load(tournamentId: string): Promise<void> {
    this.loading.set(true);
    try {
      const tournament = await this.facade.getTournamentById(tournamentId);
      if (!tournament) {
        this.tournament.set(null);
        this.matches.set([]);
        this.pending.set([]);
        return;
      }

      const [matches, players] = await Promise.all([
        this.facade.getMatchesByTournamentId(tournamentId),
        this.facade.getPlayers(),
      ]);

      this.tournament.set(tournament);
      this.matches.set(matches);
      this.players.set(players);
      this.pending.set(await this.resolvePending(tournament));
      this.slots.set(await this.resolveSlots(tournament));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * A fila: o que ainda falta jogar. Com a chave pausada por uma decisão de
   * quadra, não há próxima (REGRAS.md §9.3).
   */
  private async resolvePending(tournament: Tournament): Promise<BracketMatch[]> {
    return this.tournaments.getPendingMatches(tournament);
  }

  /** O mesmo que a fila, mais as vagas já reservadas por quem se classificou. */
  private async resolveSlots(tournament: Tournament): Promise<BracketSlot[]> {
    const inicial = this.tournaments
      .generateInitialMatches(tournament)
      .filter((bracket) => !this.findSavedMatch(bracket));

    return [...inicial, ...(await this.tournaments.getNextSlots(tournament))];
  }

  async reload(): Promise<void> {
    const id = this.tournament()?.id;
    if (id) {
      await this.load(id);
    }
  }

  /**
   * Salva o placar. O primeiro placar de uma partida trava: uma segunda
   * tentativa devolve o que já está lá, em vez de sobrescrever.
   */
  async reportScore(
    bracket: BracketMatch,
    scoreA: number,
    scoreB: number,
    reportedBy: string | null,
  ): Promise<{ saved: boolean; existing: Match | null }> {
    const tournament = this.tournament();
    if (!tournament) {
      return { saved: false, existing: null };
    }

    // Vôlei não tem empate: nem o sheet nem nenhum outro caminho salva um.
    if (scoreA === scoreB) {
      return { saved: false, existing: null };
    }

    const existing = this.findSavedMatch(bracket);
    if (existing) {
      return { saved: false, existing };
    }

    const now = new Date().toISOString();
    const match: Match = {
      id: crypto.randomUUID(),
      tournamentId: tournament.id,
      sessionId: tournament.sessionId,
      phase: bracket.phase,
      teamAId: bracket.teamAId,
      teamBId: bracket.teamBId,
      scoreA,
      scoreB,
      winnerId: scoreA > scoreB ? bracket.teamAId : bracket.teamBId,
      loserId: scoreA > scoreB ? bracket.teamBId : bracket.teamAId,
      pointDifference: Math.abs(scoreA - scoreB),
      playedAt: now,
      reportedBy,
      correctedBy: null,
      correctedAt: null,
      createdAt: now,
    };

    await this.facade.saveMatch(match);

    tournament.matches = [...tournament.matches, match.id];
    await this.facade.saveTournament(tournament);

    // Fechar a rodada 1 é o que marca a eliminação direta: um efeito que mora
    // no caminho de salvar, nunca na leitura da fila (§7.5).
    const allMatches = await this.facade.getMatchesByTournamentId(tournament.id);
    await this.tournaments.closeRound1(tournament, allMatches);
    await this.finishIfComplete(tournament, allMatches);

    await this.reload();
    return { saved: true, existing: null };
  }

  /**
   * Corrigir vale até 30 min depois de o campeonato encerrar?
   *
   * A pergunta é da tela (para esconder o botão) e da gravação (para recusar).
   * Uma condição só, lida pelos dois: se a tela fosse a única guardiã, o estado
   * errado entraria por outro caminho — a lição do ticket 32.
   */
  readonly correctionOpen = computed(() => {
    const tournament = this.tournament();
    if (!tournament) {
      return false;
    }

    return correctionWindowOpen(
      tournamentTiming(tournament.createdAt, this.matches(), new Date().toISOString()),
      new Date().toISOString(),
    );
  });

  /** Correção de placar já lançado: de qualquer jogador, e registra quem foi. */
  async correctScore(
    matchId: string,
    scoreA: number,
    scoreB: number,
    correctedBy: string | null,
  ): Promise<CorrectionResult> {
    const match = await this.facade.getMatchById(matchId);
    if (!match) {
      return { saved: false, refusal: 'not-found' };
    }

    // A recusa mora aqui, e não só na tela: é o mesmo caminho que um link
    // antigo, uma aba aberta desde ontem ou a tela de outra pessoa alcançam.
    if (!this.correctionOpen()) {
      return { saved: false, refusal: 'window-closed' };
    }

    const corrected: Match = {
      ...match,
      scoreA,
      scoreB,
      winnerId: scoreA > scoreB ? match.teamAId : match.teamBId,
      loserId: scoreA > scoreB ? match.teamBId : match.teamAId,
      pointDifference: Math.abs(scoreA - scoreB),
      correctedBy,
      correctedAt: new Date().toISOString(),
    };

    const tournament = this.tournament();
    if (!tournament) {
      // Sem o campeonato em mãos não dá para dizer o que a correção derruba, e
      // gravar só o placar deixaria o resto apontando para o resultado antigo.
      await this.facade.correctMatchScore({
        matchId: match.id,
        scoreA,
        scoreB,
        obsoleteMatchIds: [],
        dissolvedTeamId: null,
      });
      await this.reload();
      return { saved: true, fallout: EMPTY_FALLOUT };
    }

    const before = priorityKeys(tournament);
    const saved = await this.facade.getMatchesByTournamentId(tournament.id);

    // A lista como ela FICA depois da correção. Tudo o que vem a seguir é a
    // pergunta "o que este resultado ainda produz?", e perguntá-la sobre o
    // placar antigo responderia que nada mudou.
    const correctedMatches = saved.map((entry) => (entry.id === match.id ? corrected : entry));

    // O encaixe primeiro, porque desfazê-lo muda a chave inteira: sem a dupla
    // sintética, as fases que ela jogou deixam de existir, e é essa a chave
    // que diz quais partidas sobraram.
    const dissolvedTeamId = this.tournaments.staleOddPlayerPlacement(tournament, correctedMatches);
    if (dissolvedTeamId) {
      this.tournaments.undoOddPlayerPlacement(tournament);
    }

    const obsolete = this.tournaments.obsoleteMatches(tournament, correctedMatches);

    // Uma chamada: o placar novo, as partidas que ele derrubou e a dupla do
    // encaixe desfeita, numa transação do banco. Separado, o apagar seria
    // recusado em silêncio — apagar partida é do dono.
    await this.facade.correctMatchScore({
      matchId: match.id,
      scoreA,
      scoreB,
      obsoleteMatchIds: obsolete.map((entry) => entry.id),
      dissolvedTeamId,
    });

    if (dissolvedTeamId) {
      tournament.updatedAt = new Date().toISOString();
      await this.facade.saveTournament(tournament);
    }

    const allMatches = await this.facade.getMatchesByTournamentId(tournament.id);

    // Depois do que caiu, o que se refaz: fechar a rodada 1 com uma decisão
    // caduca ainda guardada seria derivar a chave a partir de um par-ou-ímpar
    // que já não é sobre as duplas empatadas.
    const droppedDecisions = await this.tournaments.dropStaleTiebreaks(tournament, allMatches);

    await this.tournaments.closeRound1(tournament, allMatches);
    await this.rederiveOutcome(tournament, allMatches);

    // O sorteio pendente nasceu destas prioridades. Mudou a prioridade, ou
    // a correção reabriu um desempate, e ele deixa de valer: o que depende
    // de um resultado é derivado de novo (tickets 35 e 36).
    const changed = priorityKeys(tournament) !== before;
    if (changed || !this.tournaments.priorityFrozen(tournament, allMatches)) {
      await this.draws.discardPendingDraw(tournament.sessionId);
    }

    await this.reload();

    const fallout: CorrectionFallout = {
      droppedDecisions,
      droppedPlacement: dissolvedTeamId !== null,
      removedMatches: obsolete.length,
    };

    // Depois do `reload`: ele repinta a tela inteira, e a frase tem de
    // sobreviver à repintura que ela explica.
    this.correctionFallout.set(hasFallout(fallout) ? fallout : null);

    return { saved: true, fallout };
  }

  /** A tela já disse o que caiu. */
  dismissFallout(): void {
    this.correctionFallout.set(null);
  }

  /**
   * A classificação e o `status` são derivados de novo, nunca mantidos.
   *
   * `finishIfComplete` só sabe **encerrar**: ele era gravado uma vez e nunca
   * mais revisitado, então uma correção que reabre a chave deixava o campeonato
   * marcado como encerrado e a classificação final do resultado antigo no banco,
   * contando nos rankings (ticket 35).
   */
  private async rederiveOutcome(tournament: Tournament, matches: Match[]): Promise<void> {
    const complete = await this.tournaments.isTournamentComplete(tournament, matches);

    const status = complete ? 'completed' : 'in-progress';
    const standings = complete ? this.tournaments.computeFinalStandings(tournament, matches) : [];

    const same =
      tournament.status === status &&
      JSON.stringify(tournament.finalStandings) === JSON.stringify(standings);
    if (same) {
      return;
    }

    tournament.status = status;
    tournament.finalStandings = standings;
    tournament.updatedAt = new Date().toISOString();
    await this.facade.saveTournament(tournament);
  }

  /** Registra quem venceu o par-ou-ímpar do encaixe. */
  async applyPlacement(survivingPlayerId: string): Promise<void> {
    const tournament = this.tournament();
    if (!tournament) {
      return;
    }

    await this.tournaments.applyOddPlayerPlacement(
      tournament,
      survivingPlayerId,
      [...this.matches()],
      this.group.playerId(),
    );
    await this.reload();
  }

  /** Registra quem venceu o par-ou-ímpar do desempate de diferença. */
  async resolveTiebreak(winnerTeamId: string): Promise<void> {
    const tournament = this.tournament();
    const tiebreak = this.tiebreak();
    if (!tournament || !tiebreak) {
      return;
    }

    await this.tournaments.recordTiebreak(
      tournament,
      tiebreak.kind,
      [...tiebreak.teamIds],
      winnerTeamId,
      this.group.playerId(),
    );
    await this.reload();
  }

  /** "RAFA + MALU" */
  teamLabel(teamId: string | null): string {
    if (!teamId) {
      return UNDEFINED_SLOT;
    }
    const team = this.team(teamId);
    if (!team) {
      return UNDEFINED_SLOT;
    }
    const byId = this.playersById();
    return team.playerIds
      .map((playerId) => byId.get(playerId)?.name ?? '?')
      .join(' + ')
      .toUpperCase();
  }

  team(teamId: string): TournamentTeam | null {
    return this.tournament()?.teams.find((team) => team.id === teamId) ?? null;
  }

  /** `playerId` nulo é o visitante: nenhuma dupla é dele. */
  teamHas(teamId: string | null, playerId: string | null): boolean {
    return teamId !== null && playerId !== null
      ? !!this.team(teamId)?.playerIds.includes(playerId)
      : false;
  }

  /** Partida já salva para esta vaga da chave. */
  findSavedMatch(bracket: BracketMatch): Match | null {
    return (
      this.matches().find(
        (match) =>
          match.phase === bracket.phase &&
          ((match.teamAId === bracket.teamAId && match.teamBId === bracket.teamBId) ||
            (match.teamAId === bracket.teamBId && match.teamBId === bracket.teamAId)),
      ) ?? null
    );
  }

  playerName(playerId: string | null): string | null {
    return playerId ? (this.playersById().get(playerId)?.name ?? null) : null;
  }

  /** Marca o campeonato como concluído quando a chave não gera mais partida. */
  private async finishIfComplete(tournament: Tournament, matches: Match[]): Promise<void> {
    const complete = await this.tournaments.isTournamentComplete(tournament, matches);
    if (!complete || tournament.status === 'completed') {
      return;
    }

    tournament.status = 'completed';
    tournament.finalStandings = this.tournaments.computeFinalStandings(tournament, matches);
    tournament.updatedAt = new Date().toISOString();
    await this.facade.saveTournament(tournament);
  }

  /**
   * Escada: o que já foi jogado, o que está em quadra e os degraus futuros do
   * formato, ainda sem dupla definida.
   */
  private buildLadder(): LadderStep[] {
    const tournament = this.tournament();
    const format = this.format();
    if (!tournament || !format) {
      return [];
    }

    const steps: LadderStep[] = [];
    const played = this.completedMatches();

    for (const match of played) {
      steps.push({
        phase: match.phase,
        phaseLabel: phaseLabel(match.phase),
        state: 'done',
        a: this.side(match.teamAId, match.scoreA, this.outcomeNote(match.teamAId)),
        b: this.side(match.teamBId, match.scoreB, this.outcomeNote(match.teamBId)),
      });
    }

    // A escada desenha as VAGAS, não só a fila: a vaga pela metade — "RAFA +
    // BIA × aguarda" — é a que estava faltando, e é ela que conta a quem já se
    // classificou que ele está na final.
    const slots = this.slots();
    slots.forEach((slot, index) => {
      steps.push({
        phase: slot.phase,
        phaseLabel: phaseLabel(slot.phase),
        state: slot.teamBId === null ? 'later' : index === 0 ? 'now' : 'next',
        a: this.side(slot.teamAId, null, this.outcomeNote(slot.teamAId)),
        b:
          slot.teamBId === null
            ? this.waitingSide()
            : this.side(slot.teamBId, null, this.outcomeNote(slot.teamBId)),
      });
    });

    // Degraus que o formato ainda prevê e que nem vaga têm: "VENCEDOR".
    const remaining = this.remainingPhases(format, [...played, ...slots]);
    for (const phase of remaining) {
      steps.push({
        phase,
        phaseLabel: phaseLabel(phase),
        state: 'later',
        a: this.emptySide(),
        b: this.emptySide(),
      });
    }

    return steps;
  }

  private remainingPhases(
    format: NonNullable<ReturnType<typeof findFormat>>,
    known: readonly { phase: MatchPhase }[],
  ): MatchPhase[] {
    const planned = plannedPhases(format, this.tournament()?.thirdPlaceEnabled ?? false);
    const used = new Map<MatchPhase, number>();
    for (const entry of known) {
      used.set(entry.phase, (used.get(entry.phase) ?? 0) + 1);
    }

    const remaining: MatchPhase[] = [];
    for (const phase of planned) {
      const left = used.get(phase) ?? 0;
      if (left > 0) {
        used.set(phase, left - 1);
      } else {
        remaining.push(phase);
      }
    }
    return remaining;
  }

  private side(teamId: string | null, score: number | null, note: string | null): LadderSide {
    const playerId = this.group.playerId();
    return {
      teamId,
      label: this.teamLabel(teamId),
      note,
      score,
      isMine: this.teamHas(teamId, playerId),
    };
  }

  private emptySide(): LadderSide {
    return { teamId: null, label: UNDEFINED_SLOT, note: null, score: null, isMine: false };
  }

  /** O lado de uma vaga pela metade: alguém já está ali, falta o adversário. */
  private waitingSide(): LadderSide {
    return { teamId: null, label: 'aguarda', note: null, score: null, isMine: false };
  }

  /** "venceu por 2", "encaixe", "bye da rodada 1". */
  private outcomeNote(teamId: string | null): string | null {
    const tournament = this.tournament();
    if (!teamId || !tournament) {
      return null;
    }

    if (tournament.oddPlayerPlacement?.encaixeTeamId === teamId) {
      return 'encaixe';
    }

    const round1 = this.matches().filter(
      (match) => match.phase === 'round-1' && match.winnerId !== null,
    );

    const inRound1 = round1.find((match) => match.teamAId === teamId || match.teamBId === teamId);
    if (inRound1) {
      return inRound1.winnerId === teamId
        ? `venceu por ${inRound1.pointDifference}`
        : `perdeu por ${inRound1.pointDifference}`;
    }

    const team = this.team(teamId);
    if (round1.length > 0 && team && !team.synthetic) {
      return 'bye da rodada 1';
    }

    return null;
  }

  /** Resultados concluídos, com a consequência de cada um em palavras. */
  private buildResults(): MatchResult[] {
    const tournament = this.tournament();
    if (!tournament) {
      return [];
    }

    const round1 = this.matches().filter(
      (match) => match.phase === 'round-1' && match.winnerId !== null,
    );
    const { winners, losers } = readRound1(round1, {
      decisions: tournament.tiebreakDecisions,
      expectedMatches: this.tournaments.generateInitialMatches(tournament).length,
      thirdPlaceEnabled: tournament.thirdPlaceEnabled,
    });
    const usesEncaixe = tournament.oddPlayerPlacementEnabled && !!tournament.waitingPlayerId;

    const consequence = (teamId: string, diff: number): string | null => {
      if (winners.length < 2) {
        return null;
      }

      if (winners[0].id === teamId) {
        return `+${diff} · direto à final`;
      }
      if (winners.some((entry) => entry.id === teamId)) {
        return `+${diff} · semifinal`;
      }
      if (losers[0].id === teamId) {
        return `−${diff} · fora`;
      }
      if (losers.some((entry) => entry.id === teamId)) {
        return usesEncaixe ? `−${diff} · par-ou-ímpar` : `−${diff} · fora`;
      }
      return null;
    };

    return this.completedMatches().map((match) => {
      const winnerId = match.winnerId!;
      const loserId = match.loserId!;
      const winnerScore = Math.max(match.scoreA, match.scoreB);
      const loserScore = Math.min(match.scoreA, match.scoreB);

      return {
        match,
        phaseLabel: phaseLabel(match.phase),
        winnerLabel: this.teamLabel(winnerId),
        loserLabel: this.teamLabel(loserId),
        winnerScore,
        loserScore,
        winnerConsequence:
          match.phase === 'round-1' ? consequence(winnerId, match.pointDifference) : null,
        loserConsequence:
          match.phase === 'round-1' ? consequence(loserId, match.pointDifference) : null,
        reportedByName: this.playerName(match.reportedBy),
        correctedByName: this.playerName(match.correctedBy),
      };
    });
  }
}
