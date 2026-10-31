import { Injectable, computed, inject, signal } from '@angular/core';
import { AppFacade } from '../facade/app.facade';
import { BracketMatch, TournamentService } from '../services/tournament.service';
import { CurrentGroupStore } from './current-group.store';
import { findFormat } from '../rules/tournament-formats';
import { phaseLabel, plannedPhases } from '../rules/bracket-phases';
import { readRound1 } from '../rules/round-1-outcome';
import {
  Match,
  MatchPhase,
  PendingTiebreak,
  Player,
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
  private readonly group = inject(CurrentGroupStore);

  readonly tournament = signal<Tournament | null>(null);
  readonly matches = signal<readonly Match[]>([]);
  readonly pending = signal<readonly BracketMatch[]>([]);
  readonly players = signal<readonly Player[]>([]);
  readonly loading = signal(false);

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

  /** A partida do usuário que ainda não tem placar. */
  readonly myMatch = computed(() => {
    const playerId = this.group.playerId();
    return (
      this.pending().find((match) =>
        [match.teamAId, match.teamBId].some((teamId) => this.teamHas(teamId, playerId)),
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
    return alive.find((team) => team.playerIds.includes(playerId)) ?? null;
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
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * A fila: as partidas da rodada inicial que ainda não têm placar, mais a
   * próxima que o chaveamento gera. Com a chave pausada por uma decisão de
   * quadra, não há próxima (REGRAS.md §9.3).
   */
  private async resolvePending(tournament: Tournament): Promise<BracketMatch[]> {
    const initial = this.tournaments
      .generateInitialMatches(tournament)
      .filter((bracket) => !this.findSavedMatch(bracket));

    const next = await this.tournaments.getNextMatches(tournament);
    return [...initial, ...next];
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

  /** Correção de placar já lançado: de qualquer jogador, e registra quem foi. */
  async correctScore(
    matchId: string,
    scoreA: number,
    scoreB: number,
    correctedBy: string | null,
  ): Promise<void> {
    const match = await this.facade.getMatchById(matchId);
    if (!match) {
      return;
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

    await this.facade.saveMatch(corrected);

    // A correção pode mudar quem saiu por mais pontos e quem vai ao encaixe.
    const tournament = this.tournament();
    if (tournament) {
      const allMatches = await this.facade.getMatchesByTournamentId(tournament.id);
      await this.tournaments.closeRound1(tournament, allMatches);
    }

    await this.reload();
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

  teamHas(teamId: string | null, playerId: string): boolean {
    return teamId ? !!this.team(teamId)?.playerIds.includes(playerId) : false;
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
    const pending = this.pending();

    for (const match of played) {
      steps.push({
        phase: match.phase,
        phaseLabel: phaseLabel(match.phase),
        state: 'done',
        a: this.side(match.teamAId, match.scoreA, this.outcomeNote(match.teamAId)),
        b: this.side(match.teamBId, match.scoreB, this.outcomeNote(match.teamBId)),
      });
    }

    pending.forEach((bracket, index) => {
      steps.push({
        phase: bracket.phase,
        phaseLabel: phaseLabel(bracket.phase),
        state: index === 0 ? 'now' : 'next',
        a: this.side(bracket.teamAId, null, this.outcomeNote(bracket.teamAId)),
        b: this.side(bracket.teamBId, null, this.outcomeNote(bracket.teamBId)),
      });
    });

    // Degraus que o formato ainda prevê e que nem vaga têm: "VENCEDOR".
    const remaining = this.remainingPhases(format, [...played, ...pending]);
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
