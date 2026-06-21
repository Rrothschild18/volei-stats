import { Injectable, inject } from '@angular/core';
import { Player, DrawProposal, DrawBadge, Team } from '../../shared/models';
import { Gender } from '../../shared/enums';
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
    priorityPlayerIds: string[]
  ): Promise<DrawProposal[]> {
    const isOdd = players.length % 2 !== 0;
    let waitingPlayerId: string | null = null;
    let playersForDraw = [...players];

    if (isOdd) {
      waitingPlayerId = this.selectWaitingPlayer(players, priorityPlayerIds);
      playersForDraw = players.filter(p => p.id !== waitingPlayerId);
    }

    const proposals: ScoredProposal[] = [];
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const shuffled = this.shuffle([...playersForDraw]);
      const teams = this.formTeams(shuffled);
      const { score, badges } = this.evaluateProposal(
        teams,
        existingPairsInSession,
        priorityPlayerIds,
        players
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
        score: proposal.score,
        badges: proposal.badges,
        selected: i === 0,
        createdAt: new Date().toISOString(),
      };
      result.push(draw);
    }

    return result;
  }

  selectWaitingPlayer(players: Player[], priorityPlayerIds: string[]): string {
    const eligible = players.filter(p => !priorityPlayerIds.includes(p.id));
    const pool = eligible.length > 0 ? eligible : players;
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx].id;
  }

  async getWaitingPlayerByHistory(
    players: Player[],
    priorityPlayerIds: string[]
  ): Promise<string> {
    const eligible = players.filter(p => !priorityPlayerIds.includes(p.id));
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
    const candidates = pool.filter(p => (waitCounts.get(p.id) || 0) === minWaits);

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

  async getPriorityPlayerIds(sessionId: string): Promise<string[]> {
    const priorityIds: string[] = [];

    // Check for waiting player from previous draw in this session
    const draws = await this.facade.getDrawsBySessionId(sessionId);
    const selectedDraws = draws.filter(d => d.selected);
    if (selectedDraws.length > 0) {
      const lastDraw = selectedDraws[selectedDraws.length - 1];
      if (lastDraw.waitingPlayerId) {
        priorityIds.push(lastDraw.waitingPlayerId);
      }
    }

    // Check for directly eliminated players from previous tournament in this session
    const tournaments = await this.facade.getTournamentsBySessionId(sessionId);
    if (tournaments.length > 0) {
      const lastTournament = tournaments[tournaments.length - 1];
      if (lastTournament.status === 'completed') {
        for (const team of lastTournament.teams) {
          if (team.eliminatedDirectly) {
            priorityIds.push(...team.playerIds);
          }
        }
      }
    }

    return [...new Set(priorityIds)];
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

  private evaluateProposal(
    teams: Team[],
    existingPairs: Set<string>,
    priorityPlayerIds: string[],
    allPlayers: Player[]
  ): { score: number; badges: DrawBadge[] } {
    let score = 100;
    const badges: DrawBadge[] = [];

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
      const p1 = allPlayers.find(p => p.id === team.playerIds[0]);
      const p2 = allPlayers.find(p => p.id === team.playerIds[1]);
      if (p1 && p2 && p1.gender === p2.gender) {
        score -= 10;
        badges.push({
          teamId: team.id,
          type: 'same-gender',
          description: 'Dupla de mesmo sexo',
        });
      }

      // Rule 3: Priority players get badge
      const hasPriority = team.playerIds.some(id => priorityPlayerIds.includes(id));
      if (hasPriority) {
        badges.push({
          teamId: team.id,
          type: 'priority-player',
          description: 'Prioridade do último campeonato',
        });
      }
    }

    // Bonus: All priority players are in teams
    const allPriorityIncluded = priorityPlayerIds.every(id =>
      teams.some(t => t.playerIds.includes(id))
    );
    if (allPriorityIncluded && priorityPlayerIds.length > 0) {
      score += 20;
    }

    return { score, badges };
  }

  private getPairKey(id1: string, id2: string): string {
    return [id1, id2].sort().join('|');
  }

  private shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
