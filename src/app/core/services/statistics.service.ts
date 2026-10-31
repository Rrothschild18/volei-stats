import { Injectable, inject } from '@angular/core';
import { MatchRepository } from '../repositories/match.repository';
import { PlayerRepository } from '../repositories/player.repository';
import { TournamentRepository } from '../repositories/tournament.repository';
import { DrawRepository } from '../repositories/draw.repository';
import { DrawProposal, Match, PlayerStats, TeamStats, Tournament } from '../../shared/models';

/**
 * Recorte de um grupo: a mesma pessoa tem números diferentes em cada vôlei, e
 * um ranking de grupo não pode misturar partidas de outro.
 */
export interface StatsScope {
  readonly sessionIds: ReadonlySet<string>;
  readonly playerIds: ReadonlySet<string>;
}

interface Tally {
  gamesPlayed: number;
  wins: number;
  losses: number;
  timesWaited: number;
}

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private matchRepo = inject(MatchRepository);
  private playerRepo = inject(PlayerRepository);
  private tournamentRepo = inject(TournamentRepository);
  private drawRepo = inject(DrawRepository);

  async getPlayerStats(playerId: string, scope?: StatsScope): Promise<PlayerStats> {
    const all = await this.getAllPlayerStats({ includeWithoutGames: true, scope });
    return (
      all.find((stats) => stats.playerId === playerId) ?? {
        playerId,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        timesWaited: 0,
        winPercentage: 0,
      }
    );
  }

  /**
   * Estatística de todos os jogadores numa leitura só — antes era uma varredura
   * das partidas por jogador (§7.12).
   */
  async getAllPlayerStats(options?: {
    includeWithoutGames?: boolean;
    scope?: StatsScope;
  }): Promise<PlayerStats[]> {
    const scope = options?.scope;
    const [players, matches, tournaments, draws] = await Promise.all([
      this.playerRepo.getAll(),
      this.matchRepo.getAll(),
      this.tournamentRepo.getAll(),
      this.drawRepo.getAll(),
    ]);

    const tally = new Map<string, Tally>();
    for (const player of players) {
      if (scope && !scope.playerIds.has(player.id)) {
        continue;
      }
      tally.set(player.id, { gamesPlayed: 0, wins: 0, losses: 0, timesWaited: 0 });
    }

    const teamsById = this.indexTeams(tournaments, scope);

    for (const match of matches) {
      if (!match.winnerId || (scope && !scope.sessionIds.has(match.sessionId))) {
        continue;
      }

      for (const teamId of [match.teamAId, match.teamBId]) {
        const playerIds = teamsById.get(teamId);
        if (!playerIds) {
          continue;
        }

        for (const playerId of playerIds) {
          const entry = tally.get(playerId);
          if (!entry) {
            continue;
          }
          entry.gamesPlayed++;
          if (match.winnerId === teamId) {
            entry.wins++;
          } else {
            entry.losses++;
          }
        }
      }
    }

    for (const playerId of this.waitingPlayerIds(
      scope ? draws.filter((draw) => scope.sessionIds.has(draw.sessionId)) : draws,
      scope ? tournaments.filter((entry) => scope.sessionIds.has(entry.sessionId)) : tournaments,
    )) {
      const entry = tally.get(playerId);
      if (entry) {
        entry.timesWaited++;
      }
    }

    const stats: PlayerStats[] = [];
    for (const [playerId, entry] of tally) {
      if (entry.gamesPlayed === 0 && !options?.includeWithoutGames) {
        continue;
      }
      stats.push({
        playerId,
        gamesPlayed: entry.gamesPlayed,
        wins: entry.wins,
        losses: entry.losses,
        timesWaited: entry.timesWaited,
        winPercentage:
          entry.gamesPlayed > 0 ? Math.round((entry.wins / entry.gamesPlayed) * 100) : 0,
      });
    }

    return stats;
  }

  async getTeamStats(scope?: StatsScope): Promise<TeamStats[]> {
    const [players, matches, tournaments] = await Promise.all([
      this.playerRepo.getAll(),
      this.matchRepo.getAll(),
      this.tournamentRepo.getAll(),
    ]);

    const teamsById = this.indexTeams(tournaments, scope);
    const byPair = new Map<string, { playerIds: [string, string]; wins: number; losses: number }>();

    for (const match of matches) {
      if (!match.winnerId || (scope && !scope.sessionIds.has(match.sessionId))) {
        continue;
      }

      for (const teamId of [match.teamAId, match.teamBId]) {
        const playerIds = teamsById.get(teamId);
        if (!playerIds) {
          continue;
        }

        const key = this.getTeamKey(playerIds);
        let entry = byPair.get(key);
        if (!entry) {
          entry = { playerIds, wins: 0, losses: 0 };
          byPair.set(key, entry);
        }

        if (match.winnerId === teamId) {
          entry.wins++;
        } else {
          entry.losses++;
        }
      }
    }

    const names = new Map(players.map((player) => [player.id, player.name]));

    return [...byPair.values()].map((entry) => {
      const gamesPlayed = entry.wins + entry.losses;
      return {
        playerIds: entry.playerIds,
        playerNames: [
          names.get(entry.playerIds[0]) ?? 'Desconhecido',
          names.get(entry.playerIds[1]) ?? 'Desconhecido',
        ] as [string, string],
        gamesPlayed,
        wins: entry.wins,
        losses: entry.losses,
        winPercentage: gamesPlayed > 0 ? Math.round((entry.wins / gamesPlayed) * 100) : 0,
      };
    });
  }

  async getDashboardData(scope?: StatsScope) {
    const [players, matches, draws, allPlayerStats, teamStats] = await Promise.all([
      this.playerRepo.getAll(),
      this.matchRepo.getAll(),
      this.drawRepo.getAll(),
      this.getAllPlayerStats({ scope }),
      this.getTeamStats(scope),
    ]);

    const inScope = <T extends { sessionId: string }>(items: readonly T[]) =>
      scope ? items.filter((item) => scope.sessionIds.has(item.sessionId)) : items;

    const activePlayers = players.filter((p) => p.active && (!scope || scope.playerIds.has(p.id)));
    const names = new Map(players.map((player) => [player.id, player.name]));

    const topWins =
      allPlayerStats.length > 0 ? allPlayerStats.reduce((a, b) => (a.wins > b.wins ? a : b)) : null;
    const topWinPct =
      allPlayerStats.length > 0
        ? allPlayerStats.reduce((a, b) => (a.winPercentage > b.winPercentage ? a : b))
        : null;
    const eligibleTeams = teamStats.filter((t) => t.gamesPlayed >= 3);
    const topTeam =
      eligibleTeams.length > 0
        ? eligibleTeams.reduce((a, b) => (a.winPercentage > b.winPercentage ? a : b))
        : null;
    const mostWaited =
      allPlayerStats.length > 0
        ? allPlayerStats.reduce((a, b) => (a.timesWaited > b.timesWaited ? a : b))
        : null;

    return {
      totalMatches: inScope(matches).filter((m) => m.winnerId).length,
      totalActivePlayers: activePlayers.length,
      topWinsPlayer: topWins ? (names.get(topWins.playerId) ?? null) : null,
      topWinsCount: topWins?.wins ?? 0,
      topWinPctPlayer: topWinPct ? (names.get(topWinPct.playerId) ?? null) : null,
      topWinPctValue: topWinPct?.winPercentage ?? 0,
      topTeam: topTeam ? topTeam.playerNames.join(' + ') : null,
      topTeamWinPct: topTeam?.winPercentage ?? 0,
      mostWaitedPlayer:
        mostWaited && mostWaited.timesWaited > 0 ? (names.get(mostWaited.playerId) ?? null) : null,
      mostWaitedCount: mostWaited?.timesWaited ?? 0,
      // Só o sorteio escolhido conta como sorteio realizado (REGRAS.md §7.6).
      totalDraws: inScope(draws).filter((draw) => draw.selected).length,
    };
  }

  /**
   * Quem ficou de avulso, uma entrada por espera.
   *
   * Conta só os sorteios escolhidos: as propostas descartadas não aconteceram
   * (§7.6). O campeonato herda o avulso do sorteio que o gerou, então contar os
   * dois duplicaria a espera.
   */
  private waitingPlayerIds(
    draws: readonly DrawProposal[],
    tournaments: readonly Tournament[],
  ): string[] {
    const waiting: string[] = [];
    const countedDrawIds = new Set<string>();

    for (const draw of draws) {
      if (!draw.selected) {
        continue;
      }
      countedDrawIds.add(draw.id);
      if (draw.waitingPlayerId) {
        waiting.push(draw.waitingPlayerId);
      }
    }

    for (const tournament of tournaments) {
      if (!countedDrawIds.has(tournament.drawId) && tournament.waitingPlayerId) {
        waiting.push(tournament.waitingPlayerId);
      }
    }

    return waiting;
  }

  /** Duplas de todos os campeonatos, para resolver o time de uma partida. */
  private indexTeams(
    tournaments: readonly Tournament[],
    scope?: StatsScope,
  ): Map<string, [string, string]> {
    const teams = new Map<string, [string, string]>();
    for (const tournament of tournaments) {
      if (scope && !scope.sessionIds.has(tournament.sessionId)) {
        continue;
      }
      for (const team of tournament.teams) {
        teams.set(team.id, team.playerIds);
      }
    }
    return teams;
  }

  private getTeamKey(playerIds: readonly [string, string]): string {
    return [...playerIds].sort().join('|');
  }

  /** Partidas de um jogador, da mais recente para a mais antiga. */
  async getMatchesForPlayer(playerId: string, scope?: StatsScope): Promise<Match[]> {
    const [matches, tournaments] = await Promise.all([
      this.matchRepo.getAll(),
      this.tournamentRepo.getAll(),
    ]);

    const teamsById = this.indexTeams(tournaments, scope);

    return matches
      .filter(
        (match) =>
          !!match.winnerId &&
          (!scope || scope.sessionIds.has(match.sessionId)) &&
          [match.teamAId, match.teamBId].some((teamId) =>
            teamsById.get(teamId)?.includes(playerId),
          ),
      )
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  }
}
