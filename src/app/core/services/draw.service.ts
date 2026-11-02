import { Injectable, inject } from '@angular/core';
import {
  DrawBadge,
  DrawProposal,
  Player,
  Team,
  Tournament,
  TournamentPriorityEntry,
} from '../../shared/models';
import { AppFacade } from '../facade/app.facade';
import { TournamentService } from './tournament.service';
import { countWaitsInSession, waitingCandidates } from '../rules/waiting-rotation';
import { dedupeProposals, proposalKey } from '../rules/draw-proposals';
import { pendingDraw } from '../rules/pending-draw';

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
  private tournaments = inject(TournamentService);

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

  /**
   * As prioridades que o próximo sorteio herda.
   *
   * O portão não é mais "campeonato finalizado": é o campeonato cujas
   * prioridades já estão decididas (ticket 36). Um campeonato em andamento
   * entra na conta assim que a rodada 1 fecha, o desempate sai e o encaixe é
   * aplicado — e é isso que permite sortear o próximo durante a final.
   *
   * O jogador avulso só ganha prioridade quando ficou de fora o campeonato
   * inteiro (encaixe desativado), o que é representado pela entrada
   * 'waiting-player-not-used' gerada na criação do campeonato.
   */
  async getPriorityEntries(sessionId: string): Promise<TournamentPriorityEntry[]> {
    const entries: TournamentPriorityEntry[] = [];
    const lastTournament = await this.lastTournamentWithFrozenPriority(sessionId);

    if (lastTournament) {
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

  /**
   * O sorteio pendente da sessão: o próximo já sorteado, sem campeonato ainda.
   */
  async getPendingDraw(sessionId: string): Promise<DrawProposal | null> {
    const [draws, tournaments] = await Promise.all([
      this.facade.getDrawsBySessionId(sessionId),
      this.facade.getTournamentsBySessionId(sessionId),
    ]);
    return pendingDraw(draws, tournaments);
  }

  /**
   * Descarta o sorteio pendente.
   *
   * Deixar de ser o escolhido é o bastante: ele sai do sorteio pendente, das
   * duplas repetidas do dia e da contagem de esperas, que são todas lidas de
   * sorteios `selected`. O registro fica, porque ele aconteceu.
   */
  async discardPendingDraw(sessionId: string): Promise<DrawProposal | null> {
    const draw = await this.getPendingDraw(sessionId);
    if (!draw) {
      return null;
    }
    return this.facade.saveDraw({ ...draw, selected: false });
  }

  /**
   * O campeonato mais recente da sessão cujas prioridades já congelaram — o
   * que o sorteio tem de ler. Caminha de trás para frente porque "o último
   * campeonato" é o mais recente por data de criação: a ordem de leitura do
   * banco não é garantida (§7.9).
   */
  private async lastTournamentWithFrozenPriority(sessionId: string): Promise<Tournament | null> {
    const tournaments = (await this.facade.getTournamentsBySessionId(sessionId)).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );

    for (let index = tournaments.length - 1; index >= 0; index--) {
      const tournament = tournaments[index];
      // Finalizado dispensa ler as partidas: ele não muda mais.
      const matches =
        tournament.status === 'completed'
          ? []
          : await this.facade.getMatchesByTournamentId(tournament.id);

      if (this.tournaments.priorityFrozen(tournament, matches)) {
        return tournament;
      }
    }

    return null;
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
      const priorityPlayerIds = priorityEntries.map((entry) => entry.playerId);
      const shuffled = this.shuffle([...playersForDraw]);
      const teams = this.prioritizeTeams(
        this.formTeams(this.seatPriorityFirst(shuffled, priorityPlayerIds)),
        priorityPlayerIds,
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

  /**
   * Senta os prioritários nas primeiras cadeiras ANTES de formar as duplas.
   *
   * Reordenar as duplas depois de formadas não basta, e era esse o furo: três
   * prioritários caem em três duplas diferentes, a ordenação põe as três na
   * frente, e a terceira fica na terceira dupla — fora do primeiro jogo, que é
   * exatamente o que a prioridade promete (REGRAS.md §3.3).
   *
   * A distribuição é um por dupla, em rodízio, e só depois a segunda cadeira:
   * com dois prioritários eles ficam nas duplas 1 e 2 (e não grudados num par
   * só, que repetiria a mesma dupla em todas as 100 tentativas); com três ou
   * quatro, cabem nas duas duplas do primeiro jogo; com mais do que isso, a
   * promessa já não cabe em um jogo, e eles ocupam o menor número de duplas.
   */
  private seatPriorityFirst(players: Player[], priorityPlayerIds: readonly string[]): Player[] {
    const totalTeams = Math.floor(players.length / 2);
    const priority = players.filter((player) => priorityPlayerIds.includes(player.id));
    if (priority.length === 0 || totalTeams === 0) {
      return players;
    }

    // Duas duplas é o primeiro jogo; mais do que isso só quando não cabe.
    const teamsUsed = Math.min(totalTeams, Math.max(2, Math.ceil(priority.length / 2)));

    const seats: number[] = [];
    for (const slot of [0, 1]) {
      for (let team = 0; team < teamsUsed; team += 1) {
        seats.push(team * 2 + slot);
      }
    }

    const seated: Player[] = new Array(players.length);
    const taken = new Set<number>();
    priority.forEach((player, index) => {
      seated[seats[index]] = player;
      taken.add(seats[index]);
    });

    // O resto entra na ordem sorteada, nas cadeiras que sobraram.
    const rest = players.filter((player) => !priorityPlayerIds.includes(player.id));
    let next = 0;
    for (let seat = 0; seat < seated.length; seat += 1) {
      if (!taken.has(seat)) {
        seated[seat] = rest[next];
        next += 1;
      }
    }

    return seated;
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
