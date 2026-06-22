import { Injectable, inject } from '@angular/core';
import { AppFacade } from '../facade/app.facade';
import {
  Tournament,
  TournamentTeam,
  TournamentStanding,
  Match,
  MatchPhase,
  TournamentPriorityEntry,
} from '../../shared/models';

export interface BracketMatch {
  phase: MatchPhase;
  teamAId: string;
  teamBId: string;
}

@Injectable({ providedIn: 'root' })
export class TournamentService {
  private facade = inject(AppFacade);

  async createTournament(
    sessionId: string,
    drawId: string,
    teams: TournamentTeam[],
    pointLimit: number,
    thirdPlaceEnabled: boolean,
    waitingPlayerId: string | null,
    oddPlayerPlacementEnabled: boolean,
  ): Promise<Tournament> {
    const usesOddPlayerPlacement = oddPlayerPlacementEnabled && !!waitingPlayerId;
    const tournament: Tournament = {
      id: crypto.randomUUID(),
      sessionId,
      drawId,
      teams,
      waitingPlayerId,
      oddPlayerPlacementEnabled: usesOddPlayerPlacement,
      oddPlayerPlacement: null,
      priorityEntries:
        waitingPlayerId && !usesOddPlayerPlacement
          ? [{ playerId: waitingPlayerId, reason: 'waiting-player-not-used' }]
          : [],
      pointLimit,
      thirdPlaceEnabled,
      matches: [],
      status: 'in-progress',
      finalStandings: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return this.facade.saveTournament(tournament);
  }

  generateInitialMatches(tournament: Tournament): BracketMatch[] {
    const count = tournament.teams.length;

    if (this.usesOddPlayerPlacement(tournament)) {
      switch (count) {
        case 3:
          return [
            { phase: 'round-1', teamAId: tournament.teams[0].id, teamBId: tournament.teams[1].id },
          ];
        case 4:
          return [
            { phase: 'round-1', teamAId: tournament.teams[0].id, teamBId: tournament.teams[1].id },
            { phase: 'round-1', teamAId: tournament.teams[2].id, teamBId: tournament.teams[3].id },
          ];
        case 5:
          return [
            { phase: 'round-1', teamAId: tournament.teams[0].id, teamBId: tournament.teams[1].id },
            { phase: 'round-1', teamAId: tournament.teams[2].id, teamBId: tournament.teams[3].id },
          ];
        default:
          return [];
      }
    }

    switch (count) {
      case 2:
        return [
          { phase: 'final', teamAId: tournament.teams[0].id, teamBId: tournament.teams[1].id },
        ];
      case 3:
        return [
          { phase: 'round-1', teamAId: tournament.teams[0].id, teamBId: tournament.teams[1].id },
        ];
      case 4:
        return [
          { phase: 'semifinal', teamAId: tournament.teams[0].id, teamBId: tournament.teams[1].id },
          { phase: 'semifinal', teamAId: tournament.teams[2].id, teamBId: tournament.teams[3].id },
        ];
      case 5:
        return [
          { phase: 'round-1', teamAId: tournament.teams[0].id, teamBId: tournament.teams[1].id },
          { phase: 'round-1', teamAId: tournament.teams[2].id, teamBId: tournament.teams[3].id },
        ];
      case 6:
        return [
          { phase: 'round-1', teamAId: tournament.teams[0].id, teamBId: tournament.teams[1].id },
          { phase: 'round-1', teamAId: tournament.teams[2].id, teamBId: tournament.teams[3].id },
          { phase: 'round-1', teamAId: tournament.teams[4].id, teamBId: tournament.teams[5].id },
        ];
      case 7:
        return [
          { phase: 'round-1', teamAId: tournament.teams[0].id, teamBId: tournament.teams[1].id },
          { phase: 'round-1', teamAId: tournament.teams[2].id, teamBId: tournament.teams[3].id },
          { phase: 'round-1', teamAId: tournament.teams[4].id, teamBId: tournament.teams[5].id },
        ];
      default:
        return [];
    }
  }

  async syncTournamentState(tournament: Tournament, matches: Match[]): Promise<Tournament> {
    this.normalizeTournament(tournament);
    const completedMatches = matches.filter((match) => match.winnerId !== null);
    let changed = false;

    if (this.usesOddPlayerPlacement(tournament) && !tournament.oddPlayerPlacement) {
      changed = this.resolveOddPlayerPlacement(tournament, completedMatches) || changed;
    }

    if (changed) {
      tournament.updatedAt = new Date().toISOString();
      await this.facade.saveTournament(tournament);
    }

    return tournament;
  }

  async getNextMatches(tournament: Tournament): Promise<BracketMatch[]> {
    this.normalizeTournament(tournament);
    const matches = await this.facade.getMatchesByTournamentId(tournament.id);
    const completedMatches = matches.filter((match) => match.winnerId !== null);

    tournament = await this.syncTournamentState(tournament, matches);

    if (this.usesOddPlayerPlacement(tournament)) {
      switch (tournament.teams.length) {
        case 3:
          return this.getNextOdd3Team(tournament, completedMatches);
        case 4:
          return this.getNextOdd4Team(tournament, completedMatches);
        case 5:
          return this.getNextOdd5Team(tournament, completedMatches);
        default:
          return [];
      }
    }

    switch (tournament.teams.length) {
      case 3:
        return this.getNext3Team(tournament, completedMatches);
      case 4:
        return this.getNext4Team(tournament, completedMatches);
      case 5:
        return this.getNext5Team(tournament, completedMatches);
      case 6:
        return this.getNext6Team(tournament, completedMatches);
      case 7:
        return this.getNext7Team(tournament, completedMatches);
      default:
        return [];
    }
  }

  computeFinalStandings(tournament: Tournament, matches: Match[]): TournamentStanding[] {
    const standings: TournamentStanding[] = [];
    const finalMatch = matches.find((match) => match.phase === 'final' && match.winnerId);
    const thirdPlaceMatch = matches.find(
      (match) => match.phase === 'third-place' && match.winnerId,
    );

    if (finalMatch) {
      standings.push({ teamId: finalMatch.winnerId!, position: 1 });
      standings.push({ teamId: finalMatch.loserId!, position: 2 });
    }

    if (thirdPlaceMatch) {
      standings.push({ teamId: thirdPlaceMatch.winnerId!, position: 3 });
      standings.push({ teamId: thirdPlaceMatch.loserId!, position: 4 });
    }

    const rankedIds = standings.map((standing) => standing.teamId);
    const unranked = tournament.teams.filter((team) => !rankedIds.includes(team.id));
    let nextPosition = standings.length + 1;

    for (const team of unranked) {
      standings.push({ teamId: team.id, position: nextPosition++ });
    }

    return standings;
  }

  isTournamentComplete(tournament: Tournament, matches: Match[]): boolean {
    const completedMatches = matches.filter((match) => match.winnerId !== null);
    const hasFinal = completedMatches.some((match) => match.phase === 'final');

    if (!hasFinal) {
      return false;
    }

    if (this.usesOddPlayerPlacement(tournament) && tournament.teams.length === 4) {
      return true;
    }

    if (!tournament.thirdPlaceEnabled) {
      return true;
    }

    if (tournament.teams.length < 4) {
      return true;
    }

    return completedMatches.some((match) => match.phase === 'third-place');
  }

  private usesOddPlayerPlacement(tournament: Tournament): boolean {
    return tournament.oddPlayerPlacementEnabled && !!tournament.waitingPlayerId;
  }

  private normalizeTournament(tournament: Tournament): void {
    tournament.waitingPlayerId ??= null;
    tournament.oddPlayerPlacementEnabled ??= false;
    tournament.oddPlayerPlacement ??= null;
    tournament.priorityEntries ??= [];

    for (const team of tournament.teams) {
      team.synthetic ??= false;
      team.originalPlayerIds ??= null;
    }
  }

  private resolveOddPlayerPlacement(tournament: Tournament, completedMatches: Match[]): boolean {
    const round1 = completedMatches.filter((match) => match.phase === 'round-1');
    const requiredRound1Matches = tournament.teams.length === 3 ? 1 : 2;

    if (!tournament.waitingPlayerId || round1.length < requiredRound1Matches) {
      return false;
    }

    const losingTeams = round1
      .map((match) => ({
        match,
        team: tournament.teams.find((team) => team.id === match.loserId),
      }))
      .filter((entry): entry is { match: Match; team: TournamentTeam } => !!entry.team);

    if (losingTeams.length === 0) {
      return false;
    }

    let directElimination: TournamentTeam | null = null;
    let placementSource = losingTeams[0].team;

    if (losingTeams.length > 1) {
      const sortedByDiff = [...losingTeams].sort(
        (entryA, entryB) => entryB.match.pointDifference - entryA.match.pointDifference,
      );

      directElimination = sortedByDiff[0].team;
      placementSource = sortedByDiff[sortedByDiff.length - 1].team;
    }

    if (directElimination && directElimination.id !== placementSource.id) {
      this.markDirectElimination(tournament, directElimination);
    }

    const originalPlayerIds =
      placementSource.originalPlayerIds ?? ([...placementSource.playerIds] as [string, string]);
    const survivingIndex = Math.random() < 0.5 ? 0 : 1;
    const survivingPlayerId = originalPlayerIds[survivingIndex];
    const eliminatedPlayerId = originalPlayerIds[survivingIndex === 0 ? 1 : 0];

    placementSource.playerIds = [survivingPlayerId, tournament.waitingPlayerId];
    placementSource.synthetic = true;
    placementSource.originalPlayerIds = originalPlayerIds;

    this.addPriorityEntries(tournament, [
      { playerId: eliminatedPlayerId, reason: 'coin-flip-loss' },
    ]);

    tournament.oddPlayerPlacement = {
      sourceTeamId: placementSource.id,
      survivingPlayerId,
      eliminatedPlayerId,
    };

    return true;
  }

  private getNextOdd3Team(tournament: Tournament, completed: Match[]): BracketMatch[] {
    const round1 = completed.filter((match) => match.phase === 'round-1');
    if (round1.length !== 1 || !tournament.oddPlayerPlacement) {
      return [];
    }

    const byeTeam = tournament.teams.find(
      (team) => !round1.some((match) => match.teamAId === team.id || match.teamBId === team.id),
    );
    const semiBye = completed.filter((match) => match.phase === 'semifinal-bye');

    if (byeTeam && semiBye.length === 0) {
      return [
        {
          phase: 'semifinal-bye',
          teamAId: tournament.oddPlayerPlacement.sourceTeamId,
          teamBId: byeTeam.id,
        },
      ];
    }

    if (semiBye.length === 1 && !completed.some((match) => match.phase === 'final')) {
      return [{ phase: 'final', teamAId: round1[0].winnerId!, teamBId: semiBye[0].winnerId! }];
    }

    return [];
  }

  private getNextOdd4Team(tournament: Tournament, completed: Match[]): BracketMatch[] {
    const round1 = completed.filter((match) => match.phase === 'round-1');
    if (round1.length !== 2 || !tournament.oddPlayerPlacement) {
      return [];
    }

    const winners = this.getRound1WinnersByDiff(round1);
    const directToFinal = winners[0]?.id;
    const semifinalOpponent = winners[1]?.id;
    const semifinals = completed.filter((match) => match.phase === 'semifinal');

    if (directToFinal && semifinalOpponent && semifinals.length === 0) {
      return [
        {
          phase: 'semifinal',
          teamAId: tournament.oddPlayerPlacement.sourceTeamId,
          teamBId: semifinalOpponent,
        },
      ];
    }

    if (
      directToFinal &&
      semifinals.length === 1 &&
      !completed.some((match) => match.phase === 'final')
    ) {
      return [{ phase: 'final', teamAId: directToFinal, teamBId: semifinals[0].winnerId! }];
    }

    return [];
  }

  private getNextOdd5Team(tournament: Tournament, completed: Match[]): BracketMatch[] {
    const round1 = completed.filter((match) => match.phase === 'round-1');
    if (round1.length !== 2 || !tournament.oddPlayerPlacement) {
      return [];
    }

    const winners = this.getRound1WinnersByDiff(round1);
    const directToFinal = winners[0]?.id;
    const semifinalSeed = winners[1]?.id;
    const byeTeam = tournament.teams.find(
      (team) => !round1.some((match) => match.teamAId === team.id || match.teamBId === team.id),
    );
    const semiBye = completed.filter((match) => match.phase === 'semifinal-bye');
    const semis = completed.filter((match) => match.phase === 'semifinal');

    if (byeTeam && semiBye.length === 0) {
      return [
        {
          phase: 'semifinal-bye',
          teamAId: tournament.oddPlayerPlacement.sourceTeamId,
          teamBId: byeTeam.id,
        },
      ];
    }

    if (semifinalSeed && semiBye.length === 1 && semis.length === 0) {
      return [{ phase: 'semifinal', teamAId: semifinalSeed, teamBId: semiBye[0].winnerId! }];
    }

    if (directToFinal && semis.length === 1) {
      const next: BracketMatch[] = [];

      if (!completed.some((match) => match.phase === 'final')) {
        next.push({ phase: 'final', teamAId: directToFinal, teamBId: semis[0].winnerId! });
      }

      if (
        tournament.thirdPlaceEnabled &&
        !completed.some((match) => match.phase === 'third-place') &&
        semiBye.length === 1
      ) {
        next.push({
          phase: 'third-place',
          teamAId: semis[0].loserId!,
          teamBId: semiBye[0].loserId!,
        });
      }

      return next;
    }

    return [];
  }

  private getNext3Team(tournament: Tournament, completed: Match[]): BracketMatch[] {
    const round1 = completed.filter((match) => match.phase === 'round-1');
    if (round1.length === 1 && !completed.some((match) => match.phase === 'final')) {
      const byeTeam = tournament.teams.find(
        (team) => !round1.some((match) => match.teamAId === team.id || match.teamBId === team.id),
      );
      if (byeTeam && round1[0].winnerId) {
        return [{ phase: 'final', teamAId: round1[0].winnerId, teamBId: byeTeam.id }];
      }
    }
    return [];
  }

  private getNext4Team(tournament: Tournament, completed: Match[]): BracketMatch[] {
    const semis = completed.filter((match) => match.phase === 'semifinal');
    if (semis.length === 2) {
      const next: BracketMatch[] = [];
      if (!completed.some((match) => match.phase === 'final')) {
        next.push({ phase: 'final', teamAId: semis[0].winnerId!, teamBId: semis[1].winnerId! });
      }
      if (
        tournament.thirdPlaceEnabled &&
        !completed.some((match) => match.phase === 'third-place')
      ) {
        next.push({ phase: 'third-place', teamAId: semis[0].loserId!, teamBId: semis[1].loserId! });
      }
      return next;
    }
    return [];
  }

  private getNext5Team(tournament: Tournament, completed: Match[]): BracketMatch[] {
    const round1 = completed.filter((match) => match.phase === 'round-1');

    if (round1.length === 2) {
      const winners = this.getRound1WinnersByDiff(round1);
      const losers = this.getRound1LosersByDiff(round1);
      const directToFinal = winners[0].id;
      const smallerDiffWinner = winners[1].id;

      this.markDirectElimination(tournament, this.getTeamById(tournament, losers[0].id));

      const byeTeam = tournament.teams.find(
        (team) => !round1.some((match) => match.teamAId === team.id || match.teamBId === team.id),
      );

      if (byeTeam && !completed.some((match) => match.phase === 'semifinal-bye')) {
        return [{ phase: 'semifinal-bye', teamAId: smallerDiffWinner, teamBId: byeTeam.id }];
      }

      const semiBye = completed.filter((match) => match.phase === 'semifinal-bye');
      if (semiBye.length === 1) {
        const next: BracketMatch[] = [];

        if (!completed.some((match) => match.phase === 'final')) {
          next.push({ phase: 'final', teamAId: directToFinal, teamBId: semiBye[0].winnerId! });
        }

        if (
          tournament.thirdPlaceEnabled &&
          !completed.some((match) => match.phase === 'third-place')
        ) {
          next.push({ phase: 'third-place', teamAId: losers[1].id, teamBId: semiBye[0].loserId! });
        }

        return next;
      }
    }

    return [];
  }

  private getNext6Team(tournament: Tournament, completed: Match[]): BracketMatch[] {
    const round1 = completed.filter((match) => match.phase === 'round-1');

    if (round1.length === 3) {
      const winners = this.getRound1WinnersByDiff(round1);
      const losers = this.getRound1LosersByDiff(round1);

      this.markDirectElimination(tournament, this.getTeamById(tournament, losers[0].id));

      if (!completed.some((match) => match.phase === 'semifinal')) {
        return [{ phase: 'semifinal', teamAId: winners[1].id, teamBId: winners[2].id }];
      }

      const semis = completed.filter((match) => match.phase === 'semifinal');
      if (semis.length === 1) {
        const next: BracketMatch[] = [];

        if (!completed.some((match) => match.phase === 'final')) {
          next.push({ phase: 'final', teamAId: winners[0].id, teamBId: semis[0].winnerId! });
        }

        if (
          tournament.thirdPlaceEnabled &&
          !completed.some((match) => match.phase === 'third-place')
        ) {
          next.push({ phase: 'third-place', teamAId: losers[1].id, teamBId: semis[0].loserId! });
        }

        return next;
      }
    }

    return [];
  }

  private getNext7Team(tournament: Tournament, completed: Match[]): BracketMatch[] {
    const round1 = completed.filter((match) => match.phase === 'round-1');

    if (round1.length === 3) {
      const winners = this.getRound1WinnersByDiff(round1);
      const losers = this.getRound1LosersByDiff(round1);
      const byeTeam = tournament.teams.find(
        (team) => !round1.some((match) => match.teamAId === team.id || match.teamBId === team.id),
      );

      this.markDirectElimination(tournament, this.getTeamById(tournament, losers[0].id));

      if (byeTeam && !completed.some((match) => match.phase === 'semifinal-bye')) {
        return [{ phase: 'semifinal-bye', teamAId: winners[1].id, teamBId: byeTeam.id }];
      }

      const semiBye = completed.filter((match) => match.phase === 'semifinal-bye');
      if (semiBye.length === 1 && !completed.some((match) => match.phase === 'semifinal')) {
        return [{ phase: 'semifinal', teamAId: semiBye[0].winnerId!, teamBId: winners[2].id }];
      }

      const semis = completed.filter((match) => match.phase === 'semifinal');
      if (semiBye.length === 1 && semis.length === 1) {
        const next: BracketMatch[] = [];

        if (!completed.some((match) => match.phase === 'final')) {
          next.push({ phase: 'final', teamAId: winners[0].id, teamBId: semis[0].winnerId! });
        }

        if (
          tournament.thirdPlaceEnabled &&
          !completed.some((match) => match.phase === 'third-place')
        ) {
          next.push({
            phase: 'third-place',
            teamAId: semiBye[0].loserId!,
            teamBId: semis[0].loserId!,
          });
        }

        return next;
      }
    }

    return [];
  }

  private getRound1WinnersByDiff(round1: Match[]): Array<{ id: string; diff: number }> {
    return round1
      .map((match) => ({ id: match.winnerId!, diff: match.pointDifference }))
      .sort((entryA, entryB) => entryB.diff - entryA.diff);
  }

  private getRound1LosersByDiff(round1: Match[]): Array<{ id: string; diff: number }> {
    return round1
      .map((match) => ({ id: match.loserId!, diff: match.pointDifference }))
      .sort((entryA, entryB) => entryB.diff - entryA.diff);
  }

  private getTeamById(tournament: Tournament, teamId: string): TournamentTeam | null {
    return tournament.teams.find((team) => team.id === teamId) ?? null;
  }

  private markDirectElimination(tournament: Tournament, team: TournamentTeam | null): void {
    if (!team) {
      return;
    }

    team.eliminated = true;
    team.eliminatedDirectly = true;
    this.addPriorityEntries(
      tournament,
      team.playerIds.map((playerId) => ({
        playerId,
        reason: 'direct-elimination' as const,
      })),
    );
  }

  private addPriorityEntries(tournament: Tournament, entries: TournamentPriorityEntry[]): void {
    const knownEntries = new Set(
      tournament.priorityEntries.map((entry) => `${entry.playerId}:${entry.reason}`),
    );

    for (const entry of entries) {
      const key = `${entry.playerId}:${entry.reason}`;
      if (!knownEntries.has(key)) {
        tournament.priorityEntries.push(entry);
        knownEntries.add(key);
      }
    }
  }
}
