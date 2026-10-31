import { Injectable, inject } from '@angular/core';
import {
  DrawBadge,
  DrawProposal,
  Player,
  Team,
  TournamentPriorityEntry,
} from '../../shared/models';
import { AppFacade } from '../facade/app.facade';
import { countWaitsInSession, waitingCandidates } from '../rules/waiting-rotation';
import { dedupeProposals, proposalKey } from '../rules/draw-proposals';

interface ScoredProposal {
  teams: Team[];
  waitingPlayerId: string | null;
  score: number;
  badges: DrawBadge[];
}

/** Tentativas de embaralhamento por avulso candidato. */
const ATTEMPTS_PER_CANDIDATE = 100;

/** Quantas propostas distintas o sorteio oferece, no máximo. */
const MAX_PROPOSALS = 3;

@Injectable({ providedIn: 'root' })
export class DrawService {
  private facade = inject(AppFacade);

  /**
   * Gera até três propostas **distintas** (REGRAS.md §9.7).
   *
   * Com número ímpar, cada proposta tem um avulso diferente, escolhido pelo
   * revezamento de espera do dia (§9.1); dentro de cada avulso, vale a melhor
   * de 100 tentativas. Com número par, são as três melhores formações
   * diferentes entre si.
   *
   * A pontuação continua ordenando as propostas, mas não vai para a tela.
   */
  async generateProposals(
    sessionId: string,
    players: Player[],
    existingPairsInSession: Set<string>,
    priorityEntries: TournamentPriorityEntry[],
  ): Promise<DrawProposal[]> {
    const priorityPlayerIds = priorityEntries.map((entry) => entry.playerId);
    const isOdd = players.length % 2 !== 0;

    const candidates = isOdd
      ? await this.waitingCandidatesForSession(sessionId, players, priorityPlayerIds)
      : [null];

    const proposals: ScoredProposal[] = [];

    for (const waitingPlayerId of this.shuffle([...candidates]).slice(0, MAX_PROPOSALS)) {
      const playersForDraw = waitingPlayerId
        ? players.filter((player) => player.id !== waitingPlayerId)
        : [...players];

      const best = this.bestOfAttempts(
        playersForDraw,
        players,
        waitingPlayerId,
        existingPairsInSession,
        priorityEntries,
        isOdd ? ATTEMPTS_PER_CANDIDATE : ATTEMPTS_PER_CANDIDATE * MAX_PROPOSALS,
        isOdd ? 1 : MAX_PROPOSALS,
      );

      proposals.push(...best);
    }

    // Com menos avulsos elegíveis do que propostas, mostra menos — melhor três
    // opções de verdade do que três cópias (§9.7).
    const unique = dedupeProposals(proposals).slice(0, MAX_PROPOSALS);

    return unique.map((proposal, index) => ({
      id: crypto.randomUUID(),
      sessionId,
      teams: proposal.teams,
      waitingPlayerId: proposal.waitingPlayerId,
      score: proposal.score,
      badges: proposal.badges,
      selected: index === 0,
      createdAt: new Date().toISOString(),
    }));
  }

  /**
   * Quem pode ficar de espera no próximo sorteio desta sessão: os presentes,
   * menos os prioritários, restritos a quem esperou menos vezes hoje (§9.1).
   */
  async waitingCandidatesForSession(
    sessionId: string,
    players: Player[],
    priorityPlayerIds: string[],
  ): Promise<string[]> {
    const waitCounts = await this.getWaitCountsInSession(sessionId);
    return waitingCandidates(
      players.map((player) => player.id),
      priorityPlayerIds,
      waitCounts,
    );
  }

  /** Quantas vezes cada jogador já esperou nesta sessão. */
  async getWaitCountsInSession(sessionId: string): Promise<Map<string, number>> {
    const [draws, tournaments] = await Promise.all([
      this.facade.getDrawsBySessionId(sessionId),
      this.facade.getTournamentsBySessionId(sessionId),
    ]);
    return countWaitsInSession(draws, tournaments);
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

    // As prioridades valem somente para campeonatos FINALIZADOS. Campeonatos
    // em andamento ou cancelados (que são excluídos) não interferem no sorteio.
    // O jogador avulso só ganha prioridade quando ficou de fora o campeonato
    // inteiro (encaixe desativado), o que é representado pela entrada
    // 'waiting-player-not-used' gerada na criação do campeonato.
    const tournaments = await this.facade.getTournamentsBySessionId(sessionId);
    const completed = tournaments
      .filter((t) => t.status === 'completed')
      // A ordem de leitura do banco não é garantida: "o último campeonato" é o
      // mais recente por data de criação (§7.9).
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    if (completed.length > 0) {
      const lastTournament = completed[completed.length - 1];
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

  /** Troca dois jogadores de lugar entre as duplas de uma proposta. */
  swapPlayers(teams: Team[], playerA: string, playerB: string): Team[] {
    return teams.map((team) => ({
      ...team,
      playerIds: team.playerIds.map((playerId) =>
        playerId === playerA ? playerB : playerId === playerB ? playerA : playerId,
      ) as [string, string],
    }));
  }

  /**
   * Recalcula a avaliação de uma proposta depois de uma troca manual: sem
   * isso, o aviso de duplas mistas continuaria descrevendo o sorteio de antes.
   */
  rescoreProposal(
    proposal: DrawProposal,
    players: Player[],
    existingPairs: Set<string>,
    priorityEntries: TournamentPriorityEntry[],
  ): DrawProposal {
    const { score, badges } = this.evaluateProposal(
      proposal.teams,
      existingPairs,
      priorityEntries,
      players,
    );
    return { ...proposal, score, badges };
  }

  /** Duplas da proposta que já jogaram juntas hoje. */
  repeatedPairs(teams: readonly Team[], existingPairs: ReadonlySet<string>): Team[] {
    return teams.filter((team) =>
      existingPairs.has(this.getPairKey(team.playerIds[0], team.playerIds[1])),
    );
  }

  /** Quais das outras propostas evitam uma dupla — texto do aviso de repetição. */
  proposalsAvoiding(proposals: readonly DrawProposal[], pairKey: string): number[] {
    return proposals
      .map((proposal, index) => ({ proposal, index }))
      .filter(
        ({ proposal }) =>
          !proposal.teams.some(
            (team) => this.getPairKey(team.playerIds[0], team.playerIds[1]) === pairKey,
          ),
      )
      .map(({ index }) => index);
  }

  getPairKey(id1: string, id2: string): string {
    return [id1, id2].sort().join('|');
  }

  /**
   * Roda as tentativas de embaralhamento e devolve as melhores formações
   * distintas para um mesmo avulso.
   */
  private bestOfAttempts(
    playersForDraw: Player[],
    allPlayers: Player[],
    waitingPlayerId: string | null,
    existingPairs: Set<string>,
    priorityEntries: TournamentPriorityEntry[],
    attempts: number,
    keep: number,
  ): ScoredProposal[] {
    const seen = new Map<string, ScoredProposal>();

    for (let attempt = 0; attempt < attempts; attempt++) {
      const shuffled = this.shuffle([...playersForDraw]);
      const teams = this.prioritizeTeams(
        this.formTeams(shuffled),
        priorityEntries.map((entry) => entry.playerId),
      );
      const { score, badges } = this.evaluateProposal(
        teams,
        existingPairs,
        priorityEntries,
        allPlayers,
      );

      const key = proposalKey(teams, waitingPlayerId);
      const previous = seen.get(key);
      if (!previous || previous.score < score) {
        seen.set(key, { teams, waitingPlayerId, score, badges });
      }
    }

    return [...seen.values()].sort((a, b) => b.score - a.score).slice(0, keep);
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
