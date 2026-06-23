import { Injectable, inject } from '@angular/core';
import {
  Player,
  DrawProposal,
  DrawBadge,
  Team,
  TournamentPriorityEntry,
} from '../../shared/models';
import { AppFacade } from '../facade/app.facade';

interface ScoredProposal {
  teams: Team[];
  waitingPlayerId: string | null;
  score: number;
  badges: DrawBadge[];
}

@Injectable({ providedIn: 'root' })
export class DrawService {
  private facade = inject(AppFacade);

  async generateProposals(
    sessionId: string,
    players: Player[],
    existingPairsInSession: Set<string>,
    priorityEntries: TournamentPriorityEntry[],
  ): Promise<DrawProposal[]> {
    const priorityPlayerIds = priorityEntries.map((entry) => entry.playerId);
    const isOdd = players.length % 2 !== 0;
    let waitingPlayerId: string | null = null;
    let playersForDraw = [...players];

    if (isOdd) {
      waitingPlayerId = this.selectWaitingPlayer(players, priorityPlayerIds);
      playersForDraw = players.filter((p) => p.id !== waitingPlayerId);
    }

    const proposals: ScoredProposal[] = [];
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const shuffled = this.shuffle([...playersForDraw]);
      const teams = this.prioritizeTeams(this.formTeams(shuffled), priorityPlayerIds);
      const { score, badges } = this.evaluateProposal(
        teams,
        existingPairsInSession,
        priorityEntries,
        players,
      );
      proposals.push({ teams, waitingPlayerId, score, badges });
    }

    proposals.sort((a, b) => b.score - a.score);

    const top3 = proposals.slice(0, 3);
    const result: DrawProposal[] = [];

    for (let i = 0; i < top3.length; i++) {
      const proposal = top3[i];
      const draw: DrawProposal = {
        id: crypto.randomUUID(),
        sessionId,
        teams: proposal.teams,
        waitingPlayerId: proposal.waitingPlayerId,
        badges: proposal.badges,
        selected: i === 0,
        createdAt: new Date().toISOString(),
      };
      result.push(draw);
    }

    return result;
  }

  selectWaitingPlayer(players: Player[], priorityPlayerIds: string[]): string {
    const eligible = players.filter((p) => !priorityPlayerIds.includes(p.id));
    const pool = eligible.length > 0 ? eligible : players;
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx].id;
  }

  async getWaitingPlayerByHistory(players: Player[], priorityPlayerIds: string[]): Promise<string> {
    const eligible = players.filter((p) => !priorityPlayerIds.includes(p.id));
    const pool = eligible.length > 0 ? eligible : players;

    const allDraws = await this.facade.getAllDraws();
    const waitCounts = new Map<string, number>();

    for (const p of pool) {
      waitCounts.set(p.id, 0);
    }

    for (const draw of allDraws) {
      if (draw.waitingPlayerId && waitCounts.has(draw.waitingPlayerId)) {
        waitCounts.set(draw.waitingPlayerId, (waitCounts.get(draw.waitingPlayerId) || 0) + 1);
      }
    }

    const minWaits = Math.min(...waitCounts.values());
    const candidates = pool.filter((p) => (waitCounts.get(p.id) || 0) === minWaits);

    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx].id;
  }

  async getExistingPairsInSession(sessionId: string): Promise<Set<string>> {
    const draws = await this.facade.getDrawsBySessionId(sessionId);
    const pairs = new Set<string>();
    for (const draw of draws) {
      if (draw.selected) {
        for (const team of draw.teams) {
          pairs.add(this.getPairKey(team.playerIds[0], team.playerIds[1]));
        }
      }
    }
    return pairs;
  }

  async getPriorityEntries(sessionId: string): Promise<TournamentPriorityEntry[]> {
    const entries: TournamentPriorityEntry[] = [];

    const draws = await this.facade.getDrawsBySessionId(sessionId);
    const tournaments = await this.facade.getTournamentsBySessionId(sessionId);

    const selectedDraws = draws.filter((d) => d.selected);
    if (selectedDraws.length > 0) {
      const lastDraw = selectedDraws[selectedDraws.length - 1];
      if (lastDraw.waitingPlayerId) {
        // Only grant priority if the waiting player truly sat out
        // (i.e., the draw's tournament did NOT use oddPlayerPlacement)
        const drawTournament = tournaments.find((t) => t.drawId === lastDraw.id);
        if (!drawTournament || !drawTournament.oddPlayerPlacementEnabled) {
          entries.push({
            playerId: lastDraw.waitingPlayerId,
            reason: 'waiting-draw',
          });
        }
      }
    }

    // Only use entries from the most recent COMPLETED tournament
    const completedTournaments = tournaments.filter((t) => t.status === 'completed');
    if (completedTournaments.length > 0) {
      const lastTournament = completedTournaments[completedTournaments.length - 1];
      if ((lastTournament.priorityEntries ?? []).length > 0) {
        entries.push(...lastTournament.priorityEntries);
      } else {
        for (const team of lastTournament.teams) {
          if (team.eliminatedDirectly) {
            entries.push(
              ...team.playerIds.map((playerId) => ({
                playerId,
                reason: 'direct-elimination' as const,
              })),
            );
          }
        }
      }
    }

    return this.deduplicatePriorityEntries(entries);
  }

  private formTeams(players: Player[]): Team[] {
    const teams: Team[] = [];
    for (let i = 0; i < players.length; i += 2) {
      teams.push({
        id: crypto.randomUUID(),
        playerIds: [players[i].id, players[i + 1].id],
      });
    }
    return teams;
  }

  private prioritizeTeams(teams: Team[], priorityPlayerIds: string[]): Team[] {
    return [...teams].sort((teamA, teamB) => {
      const priorityCountA = this.getPriorityCount(teamA, priorityPlayerIds);
      const priorityCountB = this.getPriorityCount(teamB, priorityPlayerIds);

      return priorityCountB - priorityCountA;
    });
  }

  private getPriorityCount(team: Team, priorityPlayerIds: string[]): number {
    return team.playerIds.reduce(
      (count, playerId) => count + (priorityPlayerIds.includes(playerId) ? 1 : 0),
      0,
    );
  }

  private evaluateProposal(
    teams: Team[],
    existingPairs: Set<string>,
    priorityEntries: TournamentPriorityEntry[],
    allPlayers: Player[],
  ): { score: number; badges: DrawBadge[] } {
    let score = 100;
    const badges: DrawBadge[] = [];
    const priorityPlayerIds = priorityEntries.map((entry) => entry.playerId);

    for (const team of teams) {
      const pairKey = this.getPairKey(team.playerIds[0], team.playerIds[1]);

      // Rule 1: No repeated pairs (highest priority, -50 penalty)
      if (existingPairs.has(pairKey)) {
        score -= 50;
        badges.push({
          teamId: team.id,
          type: 'repeated-pair',
          description: 'Dupla repetida',
        });
      }

      // Rule 2: Gender balance (prefer mixed teams, -10 penalty)
      const p1 = allPlayers.find((p) => p.id === team.playerIds[0]);
      const p2 = allPlayers.find((p) => p.id === team.playerIds[1]);
      if (p1 && p2 && p1.gender === p2.gender) {
        score -= 10;
        badges.push({
          teamId: team.id,
          type: 'same-gender',
          description: 'Dupla de mesmo sexo',
        });
      }

      // Rule 3: Priority players get badge
      const teamPriorityEntries = priorityEntries.filter((entry) =>
        team.playerIds.includes(entry.playerId),
      );
      for (const entry of teamPriorityEntries) {
        badges.push({
          teamId: team.id,
          type: 'priority-player',
          description: this.getPriorityReasonLabel(entry.reason),
        });
      }
    }

    // Bonus: All priority players are in teams
    const allPriorityIncluded = priorityPlayerIds.every((id) =>
      teams.some((t) => t.playerIds.includes(id)),
    );
    if (allPriorityIncluded && priorityPlayerIds.length > 0) {
      score += 20;
    }

    return { score, badges };
  }

  getPairKey(id1: string, id2: string): string {
    return [id1, id2].sort().join('|');
  }

  private deduplicatePriorityEntries(
    entries: TournamentPriorityEntry[],
  ): TournamentPriorityEntry[] {
    const seen = new Set<string>();

    return entries.filter((entry) => {
      const key = `${entry.playerId}:${entry.reason}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  private getPriorityReasonLabel(reason: TournamentPriorityEntry['reason']): string {
    switch (reason) {
      case 'waiting-draw':
        return 'Prioridade: ficou em espera no sorteio anterior';
      case 'direct-elimination':
        return 'Prioridade: eliminado por maior diferença no campeonato passado';
      case 'coin-flip-loss':
        return 'Prioridade: perdeu o par ou ímpar no encaixe';
      case 'waiting-player-not-used':
        return 'Prioridade: jogador avulso não entrou no campeonato passado';
      default:
        return 'Prioridade do último campeonato';
    }
  }

  private shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
