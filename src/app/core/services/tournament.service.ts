import { Injectable, inject } from '@angular/core';
import { AppFacade } from '../facade/app.facade';
import { Tournament, TournamentTeam, TournamentStanding, Match, MatchPhase } from '../../shared/models';

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
    thirdPlaceEnabled: boolean
  ): Promise<Tournament> {
    const tournament: Tournament = {
      id: crypto.randomUUID(),
      sessionId,
      drawId,
      teams,
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

  generateInitialMatches(teams: TournamentTeam[]): BracketMatch[] {
    const count = teams.length;

    switch (count) {
      case 2:
        return this.generate2TeamBracket(teams);
      case 3:
        return this.generate3TeamBracket(teams);
      case 4:
        return this.generate4TeamBracket(teams);
      case 5:
        return this.generate5TeamBracket(teams);
      case 6:
        return this.generate6TeamBracket(teams);
      case 7:
        return this.generate7TeamBracket(teams);
      default:
        return [];
    }
  }

  private generate2TeamBracket(teams: TournamentTeam[]): BracketMatch[] {
    return [{ phase: 'final', teamAId: teams[0].id, teamBId: teams[1].id }];
  }

  private generate3TeamBracket(teams: TournamentTeam[]): BracketMatch[] {
    // 2 teams play round 1, 3rd waits for final
    return [{ phase: 'round-1', teamAId: teams[0].id, teamBId: teams[1].id }];
  }

  private generate4TeamBracket(teams: TournamentTeam[]): BracketMatch[] {
    return [
      { phase: 'semifinal', teamAId: teams[0].id, teamBId: teams[1].id },
      { phase: 'semifinal', teamAId: teams[2].id, teamBId: teams[3].id },
    ];
  }

  private generate5TeamBracket(teams: TournamentTeam[]): BracketMatch[] {
    // 4 teams play round 1, 5th is bye
    return [
      { phase: 'round-1', teamAId: teams[0].id, teamBId: teams[1].id },
      { phase: 'round-1', teamAId: teams[2].id, teamBId: teams[3].id },
    ];
  }

  private generate6TeamBracket(teams: TournamentTeam[]): BracketMatch[] {
    return [
      { phase: 'round-1', teamAId: teams[0].id, teamBId: teams[1].id },
      { phase: 'round-1', teamAId: teams[2].id, teamBId: teams[3].id },
      { phase: 'round-1', teamAId: teams[4].id, teamBId: teams[5].id },
    ];
  }

  private generate7TeamBracket(teams: TournamentTeam[]): BracketMatch[] {
    // 6 teams play round 1, 7th is bye
    return [
      { phase: 'round-1', teamAId: teams[0].id, teamBId: teams[1].id },
      { phase: 'round-1', teamAId: teams[2].id, teamBId: teams[3].id },
      { phase: 'round-1', teamAId: teams[4].id, teamBId: teams[5].id },
    ];
  }

  async getNextMatches(tournament: Tournament): Promise<BracketMatch[]> {
    const matches = await this.facade.getMatchesByTournamentId(tournament.id);
    const completedMatches = matches.filter(m => m.winnerId !== null);
    const teamCount = tournament.teams.length;

    switch (teamCount) {
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

  private getNext3Team(tournament: Tournament, completed: Match[]): BracketMatch[] {
    const round1 = completed.filter(m => m.phase === 'round-1');
    if (round1.length === 1 && !completed.some(m => m.phase === 'final')) {
      const byeTeam = tournament.teams.find(t =>
        !round1.some(m => m.teamAId === t.id || m.teamBId === t.id)
      );
      if (byeTeam && round1[0].winnerId) {
        return [{ phase: 'final', teamAId: round1[0].winnerId, teamBId: byeTeam.id }];
      }
    }
    return [];
  }

  private getNext4Team(tournament: Tournament, completed: Match[]): BracketMatch[] {
    const semis = completed.filter(m => m.phase === 'semifinal');
    if (semis.length === 2) {
      const next: BracketMatch[] = [];
      if (!completed.some(m => m.phase === 'final')) {
        next.push({ phase: 'final', teamAId: semis[0].winnerId!, teamBId: semis[1].winnerId! });
      }
      if (tournament.thirdPlaceEnabled && !completed.some(m => m.phase === 'third-place')) {
        next.push({ phase: 'third-place', teamAId: semis[0].loserId!, teamBId: semis[1].loserId! });
      }
      return next;
    }
    return [];
  }

  private getNext5Team(tournament: Tournament, completed: Match[]): BracketMatch[] {
    const round1 = completed.filter(m => m.phase === 'round-1');

    if (round1.length === 2) {
      const winners = round1.map(m => ({ id: m.winnerId!, diff: m.pointDifference, match: m }));
      const losers = round1.map(m => ({ id: m.loserId!, diff: m.pointDifference, match: m }));

      winners.sort((a, b) => b.diff - a.diff);
      losers.sort((a, b) => b.diff - a.diff);

      const directToFinal = winners[0].id;
      const smallerDiffWinner = winners[1].id;
      const eliminatedDirectly = losers[0].id;
      const smallerDiffLoser = losers[1].id;

      // Mark eliminated team
      const elimTeam = tournament.teams.find(t => t.id === eliminatedDirectly);
      if (elimTeam) {
        elimTeam.eliminated = true;
        elimTeam.eliminatedDirectly = true;
      }

      const byeTeam = tournament.teams.find(t =>
        !round1.some(m => m.teamAId === t.id || m.teamBId === t.id)
      );

      if (byeTeam && !completed.some(m => m.phase === 'semifinal-bye')) {
        return [{ phase: 'semifinal-bye', teamAId: smallerDiffWinner, teamBId: byeTeam.id }];
      }
    }

    const semiBye = completed.filter(m => m.phase === 'semifinal-bye');
    if (semiBye.length === 1 && round1.length === 2) {
      const next: BracketMatch[] = [];
      const winners = round1.map(m => ({ id: m.winnerId!, diff: m.pointDifference }));
      winners.sort((a, b) => b.diff - a.diff);
      const directToFinal = winners[0].id;

      if (!completed.some(m => m.phase === 'final')) {
        next.push({ phase: 'final', teamAId: directToFinal, teamBId: semiBye[0].winnerId! });
      }

      if (tournament.thirdPlaceEnabled && !completed.some(m => m.phase === 'third-place')) {
        const losers = round1.map(m => ({ id: m.loserId!, diff: m.pointDifference }));
        losers.sort((a, b) => b.diff - a.diff);
        const smallerDiffLoser = losers[1].id;
        next.push({ phase: 'third-place', teamAId: smallerDiffLoser, teamBId: semiBye[0].loserId! });
      }

      return next;
    }

    return [];
  }

  private getNext6Team(tournament: Tournament, completed: Match[]): BracketMatch[] {
    const round1 = completed.filter(m => m.phase === 'round-1');

    if (round1.length === 3) {
      const winners = round1.map(m => ({ id: m.winnerId!, diff: m.pointDifference }));
      const losers = round1.map(m => ({ id: m.loserId!, diff: m.pointDifference }));

      winners.sort((a, b) => b.diff - a.diff);
      losers.sort((a, b) => b.diff - a.diff);

      // Biggest diff winner goes to final directly
      const directToFinal = winners[0].id;
      // Other two winners play semifinal
      const semiA = winners[1].id;
      const semiB = winners[2].id;

      // Biggest diff loser eliminated
      const elimTeam = tournament.teams.find(t => t.id === losers[0].id);
      if (elimTeam) {
        elimTeam.eliminated = true;
        elimTeam.eliminatedDirectly = true;
      }

      if (!completed.some(m => m.phase === 'semifinal')) {
        return [{ phase: 'semifinal', teamAId: semiA, teamBId: semiB }];
      }
    }

    const semis = completed.filter(m => m.phase === 'semifinal');
    if (semis.length === 1 && round1.length === 3) {
      const next: BracketMatch[] = [];
      const winners = round1.map(m => ({ id: m.winnerId!, diff: m.pointDifference }));
      winners.sort((a, b) => b.diff - a.diff);
      const directToFinal = winners[0].id;

      if (!completed.some(m => m.phase === 'final')) {
        next.push({ phase: 'final', teamAId: directToFinal, teamBId: semis[0].winnerId! });
      }

      if (tournament.thirdPlaceEnabled && !completed.some(m => m.phase === 'third-place')) {
        const losers = round1.map(m => ({ id: m.loserId!, diff: m.pointDifference }));
        losers.sort((a, b) => b.diff - a.diff);
        const smallerDiffLoser1 = losers[1].id;
        const smallerDiffLoser2 = losers[2].id;
        // Between the two remaining losers vs semi loser - simplified: semi loser vs best remaining loser
        next.push({ phase: 'third-place', teamAId: smallerDiffLoser1, teamBId: semis[0].loserId! });
      }

      return next;
    }

    return [];
  }

  private getNext7Team(tournament: Tournament, completed: Match[]): BracketMatch[] {
    const round1 = completed.filter(m => m.phase === 'round-1');

    if (round1.length === 3) {
      const winners = round1.map(m => ({ id: m.winnerId!, diff: m.pointDifference }));
      const losers = round1.map(m => ({ id: m.loserId!, diff: m.pointDifference }));

      winners.sort((a, b) => b.diff - a.diff);
      losers.sort((a, b) => b.diff - a.diff);

      const directToFinal = winners[0].id;
      const elimTeam = tournament.teams.find(t => t.id === losers[0].id);
      if (elimTeam) {
        elimTeam.eliminated = true;
        elimTeam.eliminatedDirectly = true;
      }

      const byeTeam = tournament.teams.find(t =>
        !round1.some(m => m.teamAId === t.id || m.teamBId === t.id)
      );

      // Remaining winners + bye team play semifinal
      if (byeTeam && !completed.some(m => m.phase === 'semifinal-bye')) {
        return [{ phase: 'semifinal-bye', teamAId: winners[1].id, teamBId: byeTeam.id }];
      }
    }

    const semiBye = completed.filter(m => m.phase === 'semifinal-bye');
    if (semiBye.length === 1 && round1.length === 3) {
      const winners = round1.map(m => ({ id: m.winnerId!, diff: m.pointDifference }));
      winners.sort((a, b) => b.diff - a.diff);

      // Now we need another semi between semiBye winner and 3rd winner
      if (!completed.some(m => m.phase === 'semifinal')) {
        return [{ phase: 'semifinal', teamAId: semiBye[0].winnerId!, teamBId: winners[2].id }];
      }
    }

    const semis = completed.filter(m => m.phase === 'semifinal');
    if (semis.length === 1 && semiBye.length === 1 && round1.length === 3) {
      const next: BracketMatch[] = [];
      const winners = round1.map(m => ({ id: m.winnerId!, diff: m.pointDifference }));
      winners.sort((a, b) => b.diff - a.diff);
      const directToFinal = winners[0].id;

      if (!completed.some(m => m.phase === 'final')) {
        next.push({ phase: 'final', teamAId: directToFinal, teamBId: semis[0].winnerId! });
      }

      if (tournament.thirdPlaceEnabled && !completed.some(m => m.phase === 'third-place')) {
        const losers = round1.map(m => ({ id: m.loserId!, diff: m.pointDifference }));
        losers.sort((a, b) => b.diff - a.diff);
        next.push({ phase: 'third-place', teamAId: semiBye[0].loserId!, teamBId: semis[0].loserId! });
      }

      return next;
    }

    return [];
  }

  computeFinalStandings(tournament: Tournament, matches: Match[]): TournamentStanding[] {
    const standings: TournamentStanding[] = [];
    const finalMatch = matches.find(m => m.phase === 'final' && m.winnerId);
    const thirdPlaceMatch = matches.find(m => m.phase === 'third-place' && m.winnerId);

    if (finalMatch) {
      standings.push({ teamId: finalMatch.winnerId!, position: 1 });
      standings.push({ teamId: finalMatch.loserId!, position: 2 });
    }

    if (thirdPlaceMatch) {
      standings.push({ teamId: thirdPlaceMatch.winnerId!, position: 3 });
      standings.push({ teamId: thirdPlaceMatch.loserId!, position: 4 });
    }

    // Remaining teams get positions based on elimination
    const rankedIds = standings.map(s => s.teamId);
    const unranked = tournament.teams.filter(t => !rankedIds.includes(t.id));
    let nextPos = standings.length + 1;
    for (const team of unranked) {
      standings.push({ teamId: team.id, position: nextPos++ });
    }

    return standings;
  }

  isTournamentComplete(tournament: Tournament, matches: Match[]): boolean {
    const completedMatches = matches.filter(m => m.winnerId !== null);
    const teamCount = tournament.teams.length;

    switch (teamCount) {
      case 2: return completedMatches.some(m => m.phase === 'final');
      case 3: return completedMatches.some(m => m.phase === 'final');
      case 4: {
        const hasFinal = completedMatches.some(m => m.phase === 'final');
        if (!tournament.thirdPlaceEnabled) return hasFinal;
        return hasFinal && completedMatches.some(m => m.phase === 'third-place');
      }
      case 5:
      case 6:
      case 7: {
        const hasFinal = completedMatches.some(m => m.phase === 'final');
        if (!tournament.thirdPlaceEnabled) return hasFinal;
        return hasFinal && completedMatches.some(m => m.phase === 'third-place');
      }
      default: return false;
    }
  }
}
