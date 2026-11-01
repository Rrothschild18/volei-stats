import { Injectable, inject } from '@angular/core';
import { AppFacade } from '../facade/app.facade';
import {
  Tournament,
  TournamentTeam,
  TournamentStanding,
  Match,
  MatchPhase,
  PendingTiebreak,
  TiebreakDecision,
  TiebreakKind,
  TournamentPriorityEntry,
} from '../../shared/models';
import { readRound1 } from '../rules/round-1-outcome';
import { priorityFrozen } from '../rules/priority-freeze';

export interface BracketMatch {
  phase: MatchPhase;
  teamAId: string;
  teamBId: string;
}

/**
 * Uma vaga da chave. Pode estar só pela METADE.
 *
 * `teamBId` nulo é uma vaga reservada: alguém já se classificou e o adversário
 * ainda não existe. É o caso da dupla que vence por mais pontos e vai direto à
 * final — a informação existe no instante em que a rodada 1 fecha, e antes
 * disto ela simplesmente não era publicada: a chave desenhava os dois lados
 * vazios, e quem se classificou via a tela de quem está assistindo.
 *
 * A fila do que dá para JOGAR continua sendo só de vagas inteiras.
 */
export interface BracketSlot {
  phase: MatchPhase;
  teamAId: string;
  teamBId: string | null;
}

/** Uma vaga inteira é uma partida que dá para jogar agora. */
function jogavel(slot: BracketSlot): slot is BracketMatch {
  return slot.teamBId !== null;
}

export const TOURNAMENT_NAMES = [
  'Escola Raul de forehand',
  'Escola vitoria tira casaco',
  'Oferecimento marmitas PF do willy',
  'faltou vontade',
  'Dava pra ter chego',
  'Tem dia que é noite',
  'Saca ni mim Douglas',
  'Não tem recepção',
  'Valendo o aluguel da quadra',
  'Marca a quadra das 9',
  'A luz atrapalhou',
  'Tira o par o impar aí',
  'Pezao beach sports',
  'Cade a lista',
  'Solta a lista',
  'Bicho do pé',
  'Peguei rede',
  'Não deixa ele contar não',
  'Quanto tá isso daí?',
  'Só ganha por conta da rede',
  'Fica vendo que agora vai errar',
  'Se esperar a Bê vai chover',
  'Fora bola',
  'Dentro bola',
];

export interface CreateTournamentInput {
  readonly sessionId: string;
  readonly drawId: string;
  /** Formato do catálogo que conduz o chaveamento (REGRAS.md §10). */
  readonly formatId: string;
  readonly name: string;
  readonly teams: TournamentTeam[];
  readonly pointLimit: number;
  readonly thirdPlaceEnabled: boolean;
  readonly waitingPlayerId: string | null;
  readonly oddPlayerPlacementEnabled: boolean;
  readonly oddPlayerLoserPriorityEnabled: boolean;
}

/** Sorteia um nome de campeonato da lista. */
export function randomTournamentName(): string {
  return TOURNAMENT_NAMES[Math.floor(Math.random() * TOURNAMENT_NAMES.length)];
}

@Injectable({ providedIn: 'root' })
export class TournamentService {
  private facade = inject(AppFacade);

  async createTournament(input: CreateTournamentInput): Promise<Tournament> {
    const usesOddPlayerPlacement = input.oddPlayerPlacementEnabled && !!input.waitingPlayerId;
    const tournament: Tournament = {
      id: crypto.randomUUID(),
      name: input.name,
      sessionId: input.sessionId,
      drawId: input.drawId,
      formatId: input.formatId,
      teams: input.teams,
      waitingPlayerId: input.waitingPlayerId,
      oddPlayerPlacementEnabled: usesOddPlayerPlacement,
      oddPlayerLoserPriorityEnabled: input.oddPlayerLoserPriorityEnabled,
      oddPlayerPlacement: null,
      priorityEntries:
        input.waitingPlayerId && !usesOddPlayerPlacement
          ? [{ playerId: input.waitingPlayerId, reason: 'waiting-player-not-used' }]
          : [],
      pointLimit: input.pointLimit,
      thirdPlaceEnabled: input.thirdPlaceEnabled,
      matches: [],
      status: 'in-progress',
      finalStandings: [],
      tiebreakDecisions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return this.facade.saveTournament(tournament);
  }

  generateInitialMatches(tournament: Tournament): BracketMatch[] {
    // Considera apenas as duplas originais do sorteio. A dupla sintética do
    // encaixe é criada depois e não participa da rodada inicial.
    const teams = tournament.teams.filter((team) => !team.synthetic);
    const count = teams.length;

    if (this.usesOddPlayerPlacement(tournament)) {
      switch (count) {
        case 3:
          return [{ phase: 'round-1', teamAId: teams[0].id, teamBId: teams[1].id }];
        case 4:
          return [
            { phase: 'round-1', teamAId: teams[0].id, teamBId: teams[1].id },
            { phase: 'round-1', teamAId: teams[2].id, teamBId: teams[3].id },
          ];
        case 5:
          return [
            { phase: 'round-1', teamAId: teams[0].id, teamBId: teams[1].id },
            { phase: 'round-1', teamAId: teams[2].id, teamBId: teams[3].id },
          ];
        default:
          return [];
      }
    }

    switch (count) {
      case 2:
        return [{ phase: 'final', teamAId: teams[0].id, teamBId: teams[1].id }];
      case 3:
        return [{ phase: 'round-1', teamAId: teams[0].id, teamBId: teams[1].id }];
      case 4:
        return [
          { phase: 'semifinal', teamAId: teams[0].id, teamBId: teams[1].id },
          { phase: 'semifinal', teamAId: teams[2].id, teamBId: teams[3].id },
        ];
      case 5:
        return [
          { phase: 'round-1', teamAId: teams[0].id, teamBId: teams[1].id },
          { phase: 'round-1', teamAId: teams[2].id, teamBId: teams[3].id },
        ];
      case 6:
        return [
          { phase: 'round-1', teamAId: teams[0].id, teamBId: teams[1].id },
          { phase: 'round-1', teamAId: teams[2].id, teamBId: teams[3].id },
          { phase: 'round-1', teamAId: teams[4].id, teamBId: teams[5].id },
        ];
      case 7:
        return [
          { phase: 'round-1', teamAId: teams[0].id, teamBId: teams[1].id },
          { phase: 'round-1', teamAId: teams[2].id, teamBId: teams[3].id },
          { phase: 'round-1', teamAId: teams[4].id, teamBId: teams[5].id },
        ];
      default:
        return [];
    }
  }

  async syncTournamentState(tournament: Tournament): Promise<Tournament> {
    this.normalizeTournament(tournament);
    return tournament;
  }

  /**
   * Indica se o campeonato está aguardando a decisão do par-ou-ímpar do encaixe
   * (rodada 1 concluída, encaixe habilitado e ainda sem placement definido).
   */
  needsOddPlayerPlacementDecision(tournament: Tournament, matches: Match[]): boolean {
    this.normalizeTournament(tournament);
    if (!this.usesOddPlayerPlacement(tournament) || tournament.oddPlayerPlacement) {
      return false;
    }
    return this.getPlacementSource(tournament, matches) !== null;
  }

  /**
   * Retorna a dupla que perdeu por menor diferença na rodada 1 (a que disputa o
   * par-ou-ímpar) com seus dois jogadores originais, além da dupla eliminada
   * diretamente (maior diferença), quando houver.
   */
  getOddPlayerPlacementCandidate(
    tournament: Tournament,
    matches: Match[],
  ): {
    sourceTeam: TournamentTeam;
    playerIds: [string, string];
    directEliminationTeamId: string | null;
  } | null {
    this.normalizeTournament(tournament);
    const completed = matches.filter((match) => match.winnerId !== null);
    const resolved = this.resolvePlacementTeams(tournament, completed);
    if (!resolved) {
      return null;
    }

    const { placementSource, directElimination } = resolved;
    const playerIds =
      placementSource.originalPlayerIds ?? ([...placementSource.playerIds] as [string, string]);

    return {
      sourceTeam: placementSource,
      playerIds,
      directEliminationTeamId: directElimination?.id ?? null,
    };
  }

  /**
   * Aplica o resultado do par-ou-ímpar escolhido pelo usuário: o jogador vencedor
   * forma dupla com o avulso e o perdedor é eliminado (entrando na prioridade
   * apenas se a flag estiver habilitada).
   */
  async applyOddPlayerPlacement(
    tournament: Tournament,
    survivingPlayerId: string,
    matches: Match[],
    decidedBy: string | null = null,
  ): Promise<Tournament> {
    this.normalizeTournament(tournament);
    if (!tournament.waitingPlayerId || tournament.oddPlayerPlacement) {
      return tournament;
    }

    const completed = matches.filter((match) => match.winnerId !== null);
    const resolved = this.resolvePlacementTeams(tournament, completed);
    if (!resolved) {
      return tournament;
    }

    const { placementSource, directElimination } = resolved;

    if (directElimination && directElimination.id !== placementSource.id) {
      this.markDirectElimination(tournament, directElimination);
    }

    const originalPlayerIds = [...placementSource.playerIds] as [string, string];

    const survivingPlayer = originalPlayerIds.includes(survivingPlayerId)
      ? survivingPlayerId
      : originalPlayerIds[0];
    const eliminatedPlayerId = originalPlayerIds.find((id) => id !== survivingPlayer)!;

    // A dupla original que perdeu o par-ou-ímpar é desfeita (eliminada, mas não
    // por mais pontos). Mantemos seus jogadores originais intactos para que as
    // partidas já jogadas continuem exibindo a dupla correta.
    placementSource.eliminated = true;
    placementSource.eliminatedDirectly = false;

    // O encaixe cria uma NOVA dupla (jogador vencedor + avulso), que assume a
    // vaga no chaveamento. Assim surge uma dupla a mais (ex.: 4 duplas + avulso
    // passam a ter uma 5ª dupla) sem misturar com as partidas anteriores.
    const encaixeTeam: TournamentTeam = {
      id: crypto.randomUUID(),
      playerIds: [survivingPlayer, tournament.waitingPlayerId],
      eliminated: false,
      eliminatedDirectly: false,
      synthetic: true,
      originalPlayerIds,
    };
    tournament.teams.push(encaixeTeam);

    if (tournament.oddPlayerLoserPriorityEnabled) {
      this.addPriorityEntries(tournament, [
        { playerId: eliminatedPlayerId, reason: 'coin-flip-loss' },
      ]);
    }

    tournament.oddPlayerPlacement = {
      sourceTeamId: placementSource.id,
      encaixeTeamId: encaixeTeam.id,
      survivingPlayerId: survivingPlayer,
      eliminatedPlayerId,
      decidedBy,
      decidedAt: new Date().toISOString(),
    };

    tournament.updatedAt = new Date().toISOString();
    return this.facade.saveTournament(tournament);
  }

  /**
   * O que dá para JOGAR agora: só vagas inteiras.
   *
   * As vagas pela metade — alguém classificado esperando adversário — ficam de
   * fora daqui de propósito: elas não são partida, e quem lê esta lista está
   * perguntando "qual é o próximo jogo?". Quem quer desenhar a chave pergunta
   * a `getNextSlots`.
   */
  async getNextMatches(tournament: Tournament): Promise<BracketMatch[]> {
    return (await this.getNextSlots(tournament)).filter(jogavel);
  }

  /** As vagas da chave, inteiras e pela metade. */
  async getNextSlots(tournament: Tournament): Promise<BracketSlot[]> {
    this.normalizeTournament(tournament);
    const matches = await this.facade.getMatchesByTournamentId(tournament.id);
    const completedMatches = matches.filter((match) => match.winnerId !== null);

    // Empate na fronteira que decide: ninguém gera partida até as duplas
    // fazerem o par-ou-ímpar e alguém registrar (REGRAS.md §9.3).
    if (this.pendingTiebreak(tournament, completedMatches)) {
      return [];
    }

    tournament = await this.syncTournamentState(tournament);

    // Contagem das duplas originais (exclui a dupla sintética do encaixe, que é
    // adicionada após a rodada 1 e não deve mudar o formato do chaveamento).
    const originalCount = tournament.teams.filter((team) => !team.synthetic).length;

    if (this.usesOddPlayerPlacement(tournament)) {
      switch (originalCount) {
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

    switch (originalCount) {
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

  /**
   * O que ainda falta jogar: a rodada inicial sem placar, mais o que o
   * chaveamento gera depois dela.
   *
   * Existe porque `getNextMatches` responde a outra pergunta — "o que vem DEPOIS
   * do que já saiu" — e não inclui as partidas da rodada inicial, que o
   * chaveamento monta de uma vez. Com uma semifinal jogada e a outra não,
   * `getNextMatches` devolve vazio, e quem lesse isso como "nada a jogar"
   * anunciaria uma chave pausada que não está pausada.
   */
  async getPendingMatches(tournament: Tournament): Promise<BracketMatch[]> {
    const matches = await this.facade.getMatchesByTournamentId(tournament.id);
    const played = (bracket: BracketMatch) =>
      matches.some(
        (match) =>
          match.phase === bracket.phase &&
          ((match.teamAId === bracket.teamAId && match.teamBId === bracket.teamBId) ||
            (match.teamAId === bracket.teamBId && match.teamBId === bracket.teamAId)),
      );

    const initial = this.generateInitialMatches(tournament).filter((bracket) => !played(bracket));
    return [...initial, ...(await this.getNextMatches(tournament))];
  }

  /**
   * Empate de diferença na posição que decide (REGRAS.md §9.3). Enquanto houver
   * um, a chave fica pausada: o app não escolhe no lugar das duplas.
   */
  pendingTiebreak(tournament: Tournament, matches: Match[]): PendingTiebreak | null {
    this.normalizeTournament(tournament);
    const round1 = matches.filter((match) => match.phase === 'round-1' && match.winnerId !== null);
    return readRound1(round1, this.round1Options(tournament)).needsTiebreak;
  }

  /**
   * As prioridades deste campeonato já valem para o próximo sorteio: a rodada
   * 1 fechou, não há desempate pendente e o encaixe, se houver, foi aplicado
   * (ticket 36).
   *
   * É o portão do sorteio e, ao mesmo tempo, o que faz o convite aparecer na
   * tela ao vivo — uma condição só, lida pelos dois, para que nunca discordem.
   */
  priorityFrozen(tournament: Tournament, matches: Match[]): boolean {
    this.normalizeTournament(tournament);
    const played = matches.filter((match) => match.winnerId !== null);

    return priorityFrozen({
      status: tournament.status,
      expectedRound1Matches: this.generateInitialMatches(tournament).filter(
        (bracket) => bracket.phase === 'round-1',
      ).length,
      playedRound1Matches: played.filter((match) => match.phase === 'round-1').length,
      pendingTiebreak: !!this.pendingTiebreak(tournament, played),
      usesOddPlayerPlacement: this.usesOddPlayerPlacement(tournament),
      oddPlayerPlacementDecided: !!tournament.oddPlayerPlacement,
    });
  }

  /** Registra quem venceu o par-ou-ímpar do desempate, e destrava a chave. */
  async recordTiebreak(
    tournament: Tournament,
    kind: TiebreakKind,
    teamIds: string[],
    winnerTeamId: string,
    decidedBy: string | null,
  ): Promise<Tournament> {
    this.normalizeTournament(tournament);
    tournament.tiebreakDecisions = [
      ...tournament.tiebreakDecisions.filter((decision) => decision.kind !== kind),
      {
        kind,
        teamIds,
        winnerTeamId,
        decidedBy,
        decidedAt: new Date().toISOString(),
      },
    ];
    tournament.updatedAt = new Date().toISOString();
    return this.facade.saveTournament(tournament);
  }

  /**
   * Derruba as decisões de quadra que a rodada 1 corrigida já não sustenta.
   *
   * Alguém fez aquele par-ou-ímpar na beira da quadra, entre **aquelas** duas
   * duplas. Se a correção mudou quem empatou, a decisão não se aplica ao empate
   * novo: ela é descartada e a chave pausa pedindo outra. Manter decisão que
   * ninguém revalida é a fonte do problema, e não a solução — é a mesma lição
   * de quando `eliminated` virou estado derivado (tickets 32 e 35).
   *
   * Devolve o que caiu, para a tela poder **dizer** — uma decisão desfeita em
   * silêncio reaparece como uma chave que pausou sem explicação.
   */
  async dropStaleTiebreaks(
    tournament: Tournament,
    matches: Match[],
  ): Promise<readonly TiebreakDecision[]> {
    this.normalizeTournament(tournament);

    const round1 = matches.filter((match) => match.phase === 'round-1' && match.winnerId !== null);
    const expected = this.generateInitialMatches(tournament).length;
    if (expected === 0 || round1.length < expected) {
      return [];
    }

    const { staleDecisions } = readRound1(round1, this.round1Options(tournament));
    if (staleDecisions.length === 0) {
      return [];
    }

    tournament.tiebreakDecisions = tournament.tiebreakDecisions.filter(
      (decision) => !staleDecisions.includes(decision),
    );
    tournament.updatedAt = new Date().toISOString();
    await this.facade.saveTournament(tournament);

    return staleDecisions;
  }

  /**
   * Fecha a rodada 1: marca a eliminação direta e a prioridade dela.
   *
   * Isso é um efeito colateral, então mora no caminho de **salvar** placar e
   * não na leitura da fila (REGRAS.md §7.5).
   */
  async closeRound1(tournament: Tournament, matches: Match[]): Promise<Tournament> {
    this.normalizeTournament(tournament);

    const round1 = matches.filter((match) => match.phase === 'round-1' && match.winnerId !== null);
    const expected = this.generateInitialMatches(tournament).length;
    if (expected === 0 || round1.length < expected) {
      return tournament;
    }

    const { losers, needsTiebreak } = readRound1(round1, this.round1Options(tournament));
    if (needsTiebreak || losers.length < 2) {
      return tournament;
    }

    // Com encaixe, a eliminação direta é marcada quando o par-ou-ímpar é
    // aplicado — lá se sabe qual dupla foi desfeita.
    if (this.usesOddPlayerPlacement(tournament)) {
      return tournament;
    }

    const eliminated = this.getTeamById(tournament, losers[0].id);
    if (!eliminated) {
      return tournament;
    }

    // Corrigir um placar da rodada 1 pode mudar quem saiu por mais pontos:
    // a marca é refeita, não acumulada.
    let changed = false;
    for (const team of tournament.teams) {
      if (team.eliminatedDirectly && team.id !== eliminated.id) {
        team.eliminatedDirectly = false;
        team.eliminated = false;
        tournament.priorityEntries = tournament.priorityEntries.filter(
          (entry) =>
            !(entry.reason === 'direct-elimination' && team.playerIds.includes(entry.playerId)),
        );
        changed = true;
      }
    }

    if (!eliminated.eliminatedDirectly) {
      this.markDirectElimination(tournament, eliminated);
      changed = true;
    }

    if (!changed) {
      return tournament;
    }

    tournament.updatedAt = new Date().toISOString();
    return this.facade.saveTournament(tournament);
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
    // A dupla original desfeita no encaixe não entra na classificação: ela
    // deixou de existir no meio do campeonato e aparece só como nota de rodapé
    // (REGRAS.md §4.6). Antes ela surgia duas vezes na tabela.
    const dissolvedTeamId = tournament.oddPlayerPlacement?.sourceTeamId ?? null;
    const unranked = tournament.teams.filter(
      (team) => !rankedIds.includes(team.id) && team.id !== dissolvedTeamId,
    );

    // Ordena as duplas que não disputaram final/3º lugar por desempenho:
    // - duplas eliminadas por mais pontos (eliminação direta) ficam por último;
    // - quem venceu mais partidas fica acima;
    // - empate é desfeito pelo saldo de pontos (quem perdeu por menos fica acima).
    const stats = this.computeTeamMatchStats(tournament, matches);
    unranked.sort((teamA, teamB) => {
      const directA = teamA.eliminatedDirectly ? 1 : 0;
      const directB = teamB.eliminatedDirectly ? 1 : 0;
      if (directA !== directB) {
        return directA - directB;
      }

      const statA = stats.get(teamA.id)!;
      const statB = stats.get(teamB.id)!;
      if (statB.wins !== statA.wins) {
        return statB.wins - statA.wins;
      }
      return statB.pointDiff - statA.pointDiff;
    });

    let nextPosition = standings.length + 1;
    for (const team of unranked) {
      standings.push({ teamId: team.id, position: nextPosition++ });
    }

    return standings;
  }

  /**
   * Calcula, para cada dupla, quantas partidas venceu e o saldo de pontos
   * acumulado, usado como critério de desempate na classificação final.
   */
  private computeTeamMatchStats(
    tournament: Tournament,
    matches: Match[],
  ): Map<string, { wins: number; pointDiff: number }> {
    const stats = new Map<string, { wins: number; pointDiff: number }>();
    for (const team of tournament.teams) {
      stats.set(team.id, { wins: 0, pointDiff: 0 });
    }

    for (const match of matches) {
      if (!match.winnerId) {
        continue;
      }

      const statA = stats.get(match.teamAId);
      const statB = stats.get(match.teamBId);
      if (statA) {
        statA.pointDiff += match.scoreA - match.scoreB;
        if (match.winnerId === match.teamAId) statA.wins++;
      }
      if (statB) {
        statB.pointDiff += match.scoreB - match.scoreA;
        if (match.winnerId === match.teamBId) statB.wins++;
      }
    }

    return stats;
  }

  /**
   * O campeonato termina quando a final já foi disputada e o chaveamento não
   * gera nenhuma partida adicional (ex.: disputa de 3º lugar pendente).
   */
  async isTournamentComplete(tournament: Tournament, matches: Match[]): Promise<boolean> {
    const hasFinal = matches.some((match) => match.phase === 'final' && match.winnerId !== null);
    if (!hasFinal) {
      return false;
    }

    const next = await this.getNextMatches(tournament);
    return next.length === 0;
  }

  private usesOddPlayerPlacement(tournament: Tournament): boolean {
    return tournament.oddPlayerPlacementEnabled && !!tournament.waitingPlayerId;
  }

  private normalizeTournament(tournament: Tournament): void {
    tournament.waitingPlayerId ??= null;
    tournament.oddPlayerPlacementEnabled ??= false;
    tournament.oddPlayerLoserPriorityEnabled ??= false;
    tournament.oddPlayerPlacement ??= null;
    tournament.priorityEntries ??= [];
    tournament.tiebreakDecisions ??= [];

    for (const team of tournament.teams) {
      team.synthetic ??= false;
      team.originalPlayerIds ??= null;
    }
  }
  private getPlacementSource(tournament: Tournament, matches: Match[]): TournamentTeam | null {
    const completed = matches.filter((match) => match.winnerId !== null);
    return this.resolvePlacementTeams(tournament, completed)?.placementSource ?? null;
  }

  /**
   * Determina, a partir das partidas da rodada 1, qual dupla disputa o par-ou-ímpar
   * (perdedora por menor diferença) e qual é eliminada diretamente (maior diferença).
   */
  private resolvePlacementTeams(
    tournament: Tournament,
    completedMatches: Match[],
  ): { placementSource: TournamentTeam; directElimination: TournamentTeam | null } | null {
    const round1 = completedMatches.filter((match) => match.phase === 'round-1');
    const requiredRound1Matches = tournament.teams.length === 3 ? 1 : 2;

    if (!tournament.waitingPlayerId || round1.length < requiredRound1Matches) {
      return null;
    }

    const { losers, needsTiebreak } = readRound1(round1, this.round1Options(tournament));
    if (needsTiebreak || losers.length === 0) {
      return null;
    }

    // Quem perdeu por menos diferença disputa o encaixe; quem perdeu por mais
    // está fora. Com uma partida só na rodada 1, não há eliminação direta.
    const placementSource = this.getTeamById(tournament, losers[losers.length - 1].id);
    if (!placementSource) {
      return null;
    }

    const directElimination = losers.length > 1 ? this.getTeamById(tournament, losers[0].id) : null;

    return { placementSource, directElimination };
  }

  private getNextOdd3Team(tournament: Tournament, completed: Match[]): BracketSlot[] {
    const round1 = completed.filter((match) => match.phase === 'round-1');
    if (round1.length !== 1 || !tournament.oddPlayerPlacement) {
      return [];
    }

    const byeTeam = this.findByeTeam(tournament, round1);
    const semiBye = completed.filter((match) => match.phase === 'semifinal-bye');

    if (byeTeam && semiBye.length === 0) {
      return [
        {
          phase: 'semifinal-bye',
          teamAId: tournament.oddPlayerPlacement.encaixeTeamId,
          teamBId: byeTeam.id,
        },
      ];
    }

    if (semiBye.length === 1 && !completed.some((match) => match.phase === 'final')) {
      return [{ phase: 'final', teamAId: round1[0].winnerId!, teamBId: semiBye[0].winnerId! }];
    }

    return [];
  }

  private getNextOdd4Team(tournament: Tournament, completed: Match[]): BracketSlot[] {
    const round1 = completed.filter((match) => match.phase === 'round-1');
    if (round1.length !== 2 || !tournament.oddPlayerPlacement) {
      return [];
    }

    const winners = this.getRound1WinnersByDiff(round1, tournament);
    const directToFinal = winners[0]?.id;
    const semifinalOpponent = winners[1]?.id;
    const semifinals = completed.filter((match) => match.phase === 'semifinal');

    if (directToFinal && semifinalOpponent && semifinals.length === 0) {
      return [
        {
          phase: 'semifinal',
          teamAId: tournament.oddPlayerPlacement.encaixeTeamId,
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

  private getNextOdd5Team(tournament: Tournament, completed: Match[]): BracketSlot[] {
    const round1 = completed.filter((match) => match.phase === 'round-1');
    if (round1.length !== 2 || !tournament.oddPlayerPlacement) {
      return [];
    }

    const winners = this.getRound1WinnersByDiff(round1, tournament);
    const directToFinal = winners[0]?.id;
    const semifinalSeed = winners[1]?.id;
    const byeTeam = this.findByeTeam(tournament, round1);
    const semiBye = completed.filter((match) => match.phase === 'semifinal-bye');
    const semis = completed.filter((match) => match.phase === 'semifinal');

    if (byeTeam && semiBye.length === 0) {
      return [
        {
          phase: 'semifinal-bye',
          teamAId: tournament.oddPlayerPlacement.encaixeTeamId,
          teamBId: byeTeam.id,
        },
        ...this.vagaNaFinal(directToFinal, completed),
      ];
    }

    if (semifinalSeed && semiBye.length === 1 && semis.length === 0) {
      return [
        { phase: 'semifinal', teamAId: semifinalSeed, teamBId: semiBye[0].winnerId! },
        ...this.vagaNaFinal(directToFinal, completed),
      ];
    }

    if (directToFinal && semis.length === 1) {
      const next: BracketSlot[] = [];

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

      return this.finalLast(next);
    }

    return [];
  }
  private getNext3Team(tournament: Tournament, completed: Match[]): BracketSlot[] {
    const round1 = completed.filter((match) => match.phase === 'round-1');
    if (round1.length !== 1) {
      return [];
    }

    const byeTeam = this.findByeTeam(tournament, round1);
    // Repescagem: a dupla que perdeu a rodada 1 enfrenta a dupla que estava de
    // espera. O vencedor avança para a final contra o vencedor da rodada 1.
    const repechage = completed.filter((match) => match.phase === 'semifinal');

    if (byeTeam && round1[0].loserId && repechage.length === 0) {
      return [
        { phase: 'semifinal', teamAId: round1[0].loserId, teamBId: byeTeam.id },
        ...this.vagaNaFinal(round1[0].winnerId ?? undefined, completed),
      ];
    }

    if (
      repechage.length === 1 &&
      round1[0].winnerId &&
      !completed.some((match) => match.phase === 'final')
    ) {
      return [{ phase: 'final', teamAId: round1[0].winnerId, teamBId: repechage[0].winnerId! }];
    }

    return [];
  }

  /**
   * Encontra a dupla que está de espera (não jogou a rodada 1), ignorando a
   * dupla sintética criada pelo encaixe.
   */
  private findByeTeam(tournament: Tournament, round1: Match[]): TournamentTeam | undefined {
    return tournament.teams.find(
      (team) =>
        !team.synthetic &&
        !team.eliminated &&
        !round1.some((match) => match.teamAId === team.id || match.teamBId === team.id),
    );
  }

  private getNext4Team(tournament: Tournament, completed: Match[]): BracketSlot[] {
    const semis = completed.filter((match) => match.phase === 'semifinal');
    if (semis.length === 2) {
      const next: BracketSlot[] = [];
      if (!completed.some((match) => match.phase === 'final')) {
        next.push({ phase: 'final', teamAId: semis[0].winnerId!, teamBId: semis[1].winnerId! });
      }
      if (
        tournament.thirdPlaceEnabled &&
        !completed.some((match) => match.phase === 'third-place')
      ) {
        next.push({ phase: 'third-place', teamAId: semis[0].loserId!, teamBId: semis[1].loserId! });
      }
      return this.finalLast(next);
    }
    return [];
  }

  private getNext5Team(tournament: Tournament, completed: Match[]): BracketSlot[] {
    const round1 = completed.filter((match) => match.phase === 'round-1');

    if (round1.length === 2) {
      const winners = this.getRound1WinnersByDiff(round1, tournament);
      const losers = this.getRound1LosersByDiff(round1, tournament);
      const directToFinal = winners[0].id;
      const smallerDiffWinner = winners[1].id;

      const byeTeam = tournament.teams.find(
        (team) => !round1.some((match) => match.teamAId === team.id || match.teamBId === team.id),
      );

      if (byeTeam && !completed.some((match) => match.phase === 'semifinal-bye')) {
        return [
          { phase: 'semifinal-bye', teamAId: smallerDiffWinner, teamBId: byeTeam.id },
          ...this.vagaNaFinal(directToFinal, completed),
        ];
      }

      const semiBye = completed.filter((match) => match.phase === 'semifinal-bye');
      if (semiBye.length === 1) {
        const next: BracketSlot[] = [];

        if (!completed.some((match) => match.phase === 'final')) {
          next.push({ phase: 'final', teamAId: directToFinal, teamBId: semiBye[0].winnerId! });
        }

        if (
          tournament.thirdPlaceEnabled &&
          !completed.some((match) => match.phase === 'third-place')
        ) {
          next.push({ phase: 'third-place', teamAId: losers[1].id, teamBId: semiBye[0].loserId! });
        }

        return this.finalLast(next);
      }
    }

    return [];
  }

  private getNext6Team(tournament: Tournament, completed: Match[]): BracketSlot[] {
    const round1 = completed.filter((match) => match.phase === 'round-1');

    if (round1.length === 3) {
      const winners = this.getRound1WinnersByDiff(round1, tournament);
      const losers = this.getRound1LosersByDiff(round1, tournament);

      if (!completed.some((match) => match.phase === 'semifinal')) {
        return [
          { phase: 'semifinal', teamAId: winners[1].id, teamBId: winners[2].id },
          ...this.vagaNaFinal(winners[0]?.id, completed),
        ];
      }

      const semis = completed.filter((match) => match.phase === 'semifinal');
      if (semis.length === 1) {
        const next: BracketSlot[] = [];

        if (!completed.some((match) => match.phase === 'final')) {
          next.push({ phase: 'final', teamAId: winners[0].id, teamBId: semis[0].winnerId! });
        }

        if (
          tournament.thirdPlaceEnabled &&
          !completed.some((match) => match.phase === 'third-place')
        ) {
          next.push({ phase: 'third-place', teamAId: losers[1].id, teamBId: semis[0].loserId! });
        }

        return this.finalLast(next);
      }
    }

    return [];
  }

  private getNext7Team(tournament: Tournament, completed: Match[]): BracketSlot[] {
    const round1 = completed.filter((match) => match.phase === 'round-1');

    if (round1.length === 3) {
      const winners = this.getRound1WinnersByDiff(round1, tournament);
      const byeTeam = tournament.teams.find(
        (team) => !round1.some((match) => match.teamAId === team.id || match.teamBId === team.id),
      );

      if (byeTeam && !completed.some((match) => match.phase === 'semifinal-bye')) {
        return [
          { phase: 'semifinal-bye', teamAId: winners[1].id, teamBId: byeTeam.id },
          ...this.vagaNaFinal(winners[0]?.id, completed),
        ];
      }

      const semiBye = completed.filter((match) => match.phase === 'semifinal-bye');
      if (semiBye.length === 1 && !completed.some((match) => match.phase === 'semifinal')) {
        return [
          { phase: 'semifinal', teamAId: semiBye[0].winnerId!, teamBId: winners[2].id },
          ...this.vagaNaFinal(winners[0]?.id, completed),
        ];
      }

      const semis = completed.filter((match) => match.phase === 'semifinal');
      if (semiBye.length === 1 && semis.length === 1) {
        const next: BracketSlot[] = [];

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

        return this.finalLast(next);
      }
    }

    return [];
  }

  private getRound1WinnersByDiff(
    round1: Match[],
    tournament: Tournament,
  ): { id: string; diff: number }[] {
    return [...readRound1(round1, this.round1Options(tournament)).winners];
  }

  private getRound1LosersByDiff(
    round1: Match[],
    tournament: Tournament,
  ): { id: string; diff: number }[] {
    return [...readRound1(round1, this.round1Options(tournament)).losers];
  }

  /** O que a leitura da rodada 1 precisa saber sobre este campeonato. */
  private round1Options(tournament: Tournament) {
    return {
      decisions: tournament.tiebreakDecisions,
      expectedMatches: this.generateInitialMatches(tournament).length,
      thirdPlaceEnabled: tournament.thirdPlaceEnabled,
    };
  }

  /**
   * A final é o ÚLTIMO jogo da noite.
   *
   * A disputa de 3º lugar vem antes: coroar o campeão e só então mandar duas
   * duplas de volta à quadra para um jogo que já não decide nada é o contrário
   * do que a noite pede. E a escada da chave sempre planejou nessa ordem — era
   * a fila que discordava.
   *
   * Mora aqui, e não em cada formato, para que um formato novo não precise
   * lembrar da regra: ela se aplica sozinha. A ordenação é estável, então as
   * outras fases mantêm a ordem em que o chaveamento as gerou.
   */
  /**
   * A vaga que a dupla já tem na final, enquanto o adversário não existe.
   *
   * Publicar isto é o ponto: a informação está decidida desde que a rodada 1
   * fecha, e sem ela a chave desenhava "VENCEDOR × VENCEDOR" numa final que já
   * tinha dono de um dos lados — e quem se classificou via a tela de quem está
   * assistindo, sem saber que ia jogar.
   */
  private vagaNaFinal(teamId: string | undefined, completed: Match[]): BracketSlot[] {
    if (!teamId || completed.some((match) => match.phase === 'final')) {
      return [];
    }
    return [{ phase: 'final', teamAId: teamId, teamBId: null }];
  }

  private finalLast(next: BracketSlot[]): BracketSlot[] {
    return [...next].sort((a, b) => Number(a.phase === 'final') - Number(b.phase === 'final'));
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
