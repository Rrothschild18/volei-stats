import { Injectable, inject } from '@angular/core';
import {
  DrawRepository,
  GroupRepository,
  MatchRepository,
  PlayerRepository,
  SessionRepository,
  TournamentRepository,
} from '../repositories';
import { StatisticsService, StatsScope } from '../services/statistics.service';
import {
  Group,
  GroupMember,
  GroupRole,
  Player,
  Session,
  DrawProposal,
  Tournament,
  Match,
  PlayerStats,
  TeamStats,
} from '../../shared/models';
import { Gender } from '../../shared/enums';

@Injectable({ providedIn: 'root' })
export class AppFacade {
  readonly #groupRepo = inject(GroupRepository);
  readonly #playerRepo = inject(PlayerRepository);
  readonly #sessionRepo = inject(SessionRepository);
  readonly #drawRepo = inject(DrawRepository);
  readonly #tournamentRepo = inject(TournamentRepository);
  readonly #matchRepo = inject(MatchRepository);
  readonly #statsService = inject(StatisticsService);

  // Groups
  async getGroups(): Promise<Group[]> {
    return this.#groupRepo.getAll();
  }

  async getGroupById(id: string): Promise<Group | undefined> {
    return this.#groupRepo.getById(id);
  }

  /** Os vôleis de que a pessoa participa, com o papel dela em cada um. */
  async getMembershipsByPlayerId(playerId: string): Promise<GroupMember[]> {
    return this.#groupRepo.getMembershipsByPlayerId(playerId);
  }

  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    return this.#groupRepo.getMembersByGroupId(groupId);
  }

  /** Muda o papel de quem já participa. */
  async saveGroupMember(
    groupId: string,
    playerId: string,
    role: GroupRole = 'player',
  ): Promise<GroupMember> {
    return this.#groupRepo.saveMember({ id: `${groupId}:${playerId}`, groupId, playerId, role });
  }

  /**
   * Passa o vôlei para outra pessoa. Não existe "rebaixar o último admin":
   * existe um dono, e ele muda de uma vez — o vôlei nunca fica sem.
   */
  async transferOwnership(groupId: string, playerId: string): Promise<Group> {
    const group = await this.#groupRepo.getById(groupId);
    if (!group) {
      throw new Error(`Vôlei ${groupId} não encontrado`);
    }

    const members = await this.#groupRepo.getMembersByGroupId(groupId);
    if (!members.some((member) => member.playerId === playerId && member.role === 'player')) {
      throw new Error('O vôlei só pode ser passado para um jogador dele');
    }

    return this.#groupRepo.save({ ...group, ownerPlayerId: playerId });
  }

  // Players
  async getPlayers(): Promise<Player[]> {
    return this.#playerRepo.getAll();
  }

  async getActivePlayers(): Promise<Player[]> {
    const all = await this.#playerRepo.getAll();
    return all.filter((p) => p.active);
  }

  async getPlayerById(id: string): Promise<Player | undefined> {
    return this.#playerRepo.getById(id);
  }

  /**
   * Cadastra alguém no vôlei. A data de nascimento não aparece aqui de
   * propósito: ela é senha, e quem a define é o banco, copiando a data inicial
   * do grupo. A tela de quem cadastra nunca precisa saber dela.
   */
  async createPlayer(groupId: string, name: string, gender: Gender): Promise<Player> {
    return this.#playerRepo.create(groupId, name, gender);
  }

  async updatePlayer(player: Player): Promise<Player> {
    player.updatedAt = new Date().toISOString();
    return this.#playerRepo.save(player);
  }

  async togglePlayerActive(id: string): Promise<Player | undefined> {
    const player = await this.#playerRepo.getById(id);
    if (!player) return undefined;
    player.active = !player.active;
    player.updatedAt = new Date().toISOString();
    return this.#playerRepo.save(player);
  }

  // Sessions
  async getSessions(): Promise<Session[]> {
    return this.#sessionRepo.getAll();
  }

  async getSessionById(id: string): Promise<Session | undefined> {
    return this.#sessionRepo.getById(id);
  }

  async getSessionsByGroupId(groupId: string): Promise<Session[]> {
    return this.#sessionRepo.getByGroupId(groupId);
  }

  /** A sessão de hoje do grupo, se alguém já a abriu. */
  async getTodaySession(groupId: string): Promise<Session | undefined> {
    const today = this.getLocalDateString();
    const sessions = await this.#sessionRepo.getByGroupId(groupId);
    return sessions.find((session) => session.date === today);
  }

  async createSession(groupId: string, playerIds: string[]): Promise<Session> {
    const session: Session = {
      id: crypto.randomUUID(),
      groupId,
      date: this.getLocalDateString(),
      playerIds,
      drawIds: [],
      tournamentIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return this.#sessionRepo.save(session);
  }

  async updateSession(session: Session): Promise<Session> {
    session.updatedAt = new Date().toISOString();
    return this.#sessionRepo.save(session);
  }

  // Draws
  async getDrawsBySessionId(sessionId: string): Promise<DrawProposal[]> {
    return this.#drawRepo.getBySessionId(sessionId);
  }

  async getDrawById(id: string): Promise<DrawProposal | undefined> {
    return this.#drawRepo.getById(id);
  }

  async saveDraw(draw: DrawProposal): Promise<DrawProposal> {
    return this.#drawRepo.save(draw);
  }

  async getAllDraws(): Promise<DrawProposal[]> {
    return this.#drawRepo.getAll();
  }

  // Tournaments
  async getTournaments(): Promise<Tournament[]> {
    return this.#tournamentRepo.getAll();
  }

  async getTournamentsBySessionId(sessionId: string): Promise<Tournament[]> {
    return this.#tournamentRepo.getBySessionId(sessionId);
  }

  async getTournamentById(id: string): Promise<Tournament | undefined> {
    return this.#tournamentRepo.getById(id);
  }

  async saveTournament(tournament: Tournament): Promise<Tournament> {
    return this.#tournamentRepo.save(tournament);
  }

  async deleteTournament(id: string): Promise<void> {
    const tournament = await this.#tournamentRepo.getById(id);

    const matches = await this.#matchRepo.getByTournamentId(id);
    for (const match of matches) {
      await this.#matchRepo.delete(match.id);
    }

    if (tournament) {
      // O sorteio que gerou o campeonato some junto: senão a espera do avulso
      // continuaria contando nas estatísticas de um campeonato que não existe
      // mais (REGRAS.md §7.6).
      if (tournament.drawId) {
        await this.#drawRepo.delete(tournament.drawId);
      }

      const session = await this.#sessionRepo.getById(tournament.sessionId);
      if (session) {
        session.tournamentIds = session.tournamentIds.filter((tid) => tid !== id);
        session.drawIds = session.drawIds.filter((drawId) => drawId !== tournament.drawId);
        await this.updateSession(session);
      }
    }

    await this.#tournamentRepo.delete(id);
  }

  // Matches
  async getMatches(): Promise<Match[]> {
    return this.#matchRepo.getAll();
  }

  async getMatchesByTournamentId(tournamentId: string): Promise<Match[]> {
    return this.#matchRepo.getByTournamentId(tournamentId);
  }

  async getMatchesBySessionId(sessionId: string): Promise<Match[]> {
    return this.#matchRepo.getBySessionId(sessionId);
  }

  /**
   * O recorte de um grupo para a estatística: as sessões e os jogadores dele.
   * Sem isso, quem joga em dois vôleis apareceria com os números somados.
   */
  async getGroupScope(groupId: string): Promise<StatsScope> {
    const [sessions, players] = await Promise.all([
      this.getSessionsByGroupId(groupId),
      this.#playerRepo.getByGroupId(groupId),
    ]);

    return {
      sessionIds: new Set(sessions.map((session) => session.id)),
      playerIds: new Set(players.map((player) => player.id)),
    };
  }

  /** Jogadores de um grupo, numa leitura só (§7.12). */
  async getPlayersByGroupId(groupId: string): Promise<Player[]> {
    return this.#playerRepo.getByGroupId(groupId);
  }

  private getLocalDateString(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  async getMatchById(id: string): Promise<Match | undefined> {
    return this.#matchRepo.getById(id);
  }

  async saveMatch(match: Match): Promise<Match> {
    return this.#matchRepo.save(match);
  }

  // Statistics
  async getPlayerStats(playerId: string): Promise<PlayerStats> {
    return this.#statsService.getPlayerStats(playerId);
  }

  async getAllPlayerStats(): Promise<PlayerStats[]> {
    return this.#statsService.getAllPlayerStats();
  }

  async getTeamStats(): Promise<TeamStats[]> {
    return this.#statsService.getTeamStats();
  }

  async getDashboardData() {
    return this.#statsService.getDashboardData();
  }

  // Export
  async exportData(): Promise<string> {
    const [groups, players, sessions, draws, tournaments, matches] = await Promise.all([
      this.#groupRepo.getAll(),
      this.#playerRepo.getAll(),
      this.#sessionRepo.getAll(),
      this.#drawRepo.getAll(),
      this.#tournamentRepo.getAll(),
      this.#matchRepo.getAll(),
    ]);
    return JSON.stringify({ groups, players, sessions, draws, tournaments, matches }, null, 2);
  }
}
