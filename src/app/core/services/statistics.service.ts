import { Injectable, inject } from '@angular/core';
import { MatchRepository } from '../repositories/match.repository';
import { PlayerRepository } from '../repositories/player.repository';
import { TournamentRepository } from '../repositories/tournament.repository';
import { DrawRepository } from '../repositories/draw.repository';
import { PlayerStats, TeamStats } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private matchRepo = inject(MatchRepository);
  private playerRepo = inject(PlayerRepository);
  private tournamentRepo = inject(TournamentRepository);
  private drawRepo = inject(DrawRepository);

  async getPlayerStats(playerId: string): Promise<PlayerStats> {
    const matches = await this.matchRepo.getAll();
    const tournaments = await this.tournamentRepo.getAll();
    const draws = await this.drawRepo.getAll();

    let gamesPlayed = 0;
    let wins = 0;
    let losses = 0;
    let timesWaited = 0;

    for (const match of matches) {
      if (!match.winnerId) continue;
      const tournament = tournaments.find((t) => t.id === match.tournamentId);
      if (!tournament) continue;

      const teamA = tournament.teams.find((t) => t.id === match.teamAId);
      const teamB = tournament.teams.find((t) => t.id === match.teamBId);

      const isInTeamA = teamA?.playerIds.includes(playerId);
      const isInTeamB = teamB?.playerIds.includes(playerId);

      if (isInTeamA || isInTeamB) {
        gamesPlayed++;
        const playerTeamId = isInTeamA ? match.teamAId : match.teamBId;
        if (match.winnerId === playerTeamId) {
          wins++;
        } else {
          losses++;
        }
      }
    }

    for (const draw of draws) {
      if (draw.waitingPlayerId === playerId) {
        timesWaited++;
      }
    }

    return {
      playerId,
      gamesPlayed,
      wins,
      losses,
      timesWaited,
      winPercentage: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0,
    };
  }

  async getAllPlayerStats(): Promise<PlayerStats[]> {
    const players = await this.playerRepo.getAll();
    const stats: PlayerStats[] = [];
    for (const player of players) {
      const playerStats = await this.getPlayerStats(player.id);
      if (playerStats.gamesPlayed > 0) {
        stats.push(playerStats);
      }
    }
    return stats;
  }

  async getTeamStats(): Promise<TeamStats[]> {
    const matches = await this.matchRepo.getAll();
    const tournaments = await this.tournamentRepo.getAll();
    const players = await this.playerRepo.getAll();
    const teamMap = new Map<
      string,
      { playerIds: [string, string]; wins: number; losses: number }
    >();

    for (const match of matches) {
      if (!match.winnerId) continue;
      const tournament = tournaments.find((t) => t.id === match.tournamentId);
      if (!tournament) continue;

      const teamA = tournament.teams.find((t) => t.id === match.teamAId);
      const teamB = tournament.teams.find((t) => t.id === match.teamBId);

      if (teamA && teamB) {
        const keyA = this.getTeamKey(teamA.playerIds);
        const keyB = this.getTeamKey(teamB.playerIds);

        if (!teamMap.has(keyA)) {
          teamMap.set(keyA, { playerIds: teamA.playerIds, wins: 0, losses: 0 });
        }
        if (!teamMap.has(keyB)) {
          teamMap.set(keyB, { playerIds: teamB.playerIds, wins: 0, losses: 0 });
        }

        const entryA = teamMap.get(keyA)!;
        const entryB = teamMap.get(keyB)!;

        if (match.winnerId === match.teamAId) {
          entryA.wins++;
          entryB.losses++;
        } else {
          entryB.wins++;
          entryA.losses++;
        }
      }
    }

    const stats: TeamStats[] = [];
    for (const [, entry] of teamMap) {
      const gamesPlayed = entry.wins + entry.losses;
      const player1 = players.find((p) => p.id === entry.playerIds[0]);
      const player2 = players.find((p) => p.id === entry.playerIds[1]);
      stats.push({
        playerIds: entry.playerIds,
        playerNames: [player1?.name || 'Desconhecido', player2?.name || 'Desconhecido'],
        gamesPlayed,
        wins: entry.wins,
        losses: entry.losses,
        winPercentage: gamesPlayed > 0 ? Math.round((entry.wins / gamesPlayed) * 100) : 0,
      });
    }

    return stats;
  }

  async getDashboardData() {
    const players = await this.playerRepo.getAll();
    const activePlayers = players.filter((p) => p.active);
    const matches = await this.matchRepo.getAll();
    const draws = await this.drawRepo.getAll();
    const allPlayerStats = await this.getAllPlayerStats();
    const teamStats = await this.getTeamStats();

    const topWins =
      allPlayerStats.length > 0 ? allPlayerStats.reduce((a, b) => (a.wins > b.wins ? a : b)) : null;
    const topWinPct =
      allPlayerStats.length > 0
        ? allPlayerStats
            .filter((s) => s.gamesPlayed >= 1)
            .reduce((a, b) => (a.winPercentage > b.winPercentage ? a : b), allPlayerStats[0])
        : null;
    const topTeam =
      teamStats.filter((t) => t.gamesPlayed >= 3).length > 0
        ? teamStats
            .filter((t) => t.gamesPlayed >= 3)
            .reduce((a, b) => (a.winPercentage > b.winPercentage ? a : b))
        : null;
    const mostWaited =
      allPlayerStats.length > 0
        ? allPlayerStats.reduce((a, b) => (a.timesWaited > b.timesWaited ? a : b))
        : null;

    return {
      totalMatches: matches.filter((m) => m.winnerId).length,
      totalActivePlayers: activePlayers.length,
      topWinsPlayer: topWins ? players.find((p) => p.id === topWins.playerId)?.name || null : null,
      topWinPctPlayer: topWinPct
        ? players.find((p) => p.id === topWinPct.playerId)?.name || null
        : null,
      topWinPctValue: topWinPct?.winPercentage || 0,
      topTeam: topTeam ? topTeam.playerNames.join(' + ') : null,
      topTeamWinPct: topTeam?.winPercentage || 0,
      mostWaitedPlayer:
        mostWaited && mostWaited.timesWaited > 0
          ? players.find((p) => p.id === mostWaited.playerId)?.name || null
          : null,
      mostWaitedCount: mostWaited?.timesWaited || 0,
      totalDraws: draws.length,
    };
  }

  private getTeamKey(playerIds: [string, string]): string {
    return [...playerIds].sort().join('|');
  }
}
