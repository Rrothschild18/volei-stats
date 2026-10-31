import { Injectable, inject } from '@angular/core';
import { GroupRepository } from '../repositories/group.repository';
import { PlayerRepository } from '../repositories/player.repository';
import { SessionRepository } from '../repositories/session.repository';
import { DrawRepository } from '../repositories/draw.repository';
import { TournamentRepository } from '../repositories/tournament.repository';
import { MatchRepository } from '../repositories/match.repository';
import { StatisticsService, StatsScope } from '../services/statistics.service';
import { IndexedDbService } from '../database/indexed-db.service';
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
  readonly #dbService = inject(IndexedDbService);

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

  async getGroupAdmins(groupId: string): Promise<GroupMember[]> {
    const members = await this.#groupRepo.getMembersByGroupId(groupId);
    return members.filter((member) => member.role === 'admin');
  }

  /** Cadastra alguém no grupo, com o papel que o admin escolheu. */
  async addGroupMember(groupId: string, playerId: string, role: GroupRole): Promise<GroupMember> {
    return this.#groupRepo.saveMember({ id: `${groupId}:${playerId}`, groupId, playerId, role });
  }

  /**
   * Troca o papel de alguém no grupo. O último admin não pode se rebaixar: o
   * grupo ficaria sem ninguém para marcar presença e sortear.
   */
  async setGroupRole(groupId: string, playerId: string, role: GroupRole): Promise<GroupMember> {
    const members = await this.#groupRepo.getMembersByGroupId(groupId);
    const member = members.find((candidate) => candidate.playerId === playerId);
    if (!member) {
      throw new Error(`Jogador ${playerId} não é membro do grupo ${groupId}`);
    }

    const admins = members.filter((candidate) => candidate.role === 'admin');
    if (role !== 'admin' && admins.length === 1 && admins[0].playerId === playerId) {
      throw new Error('O grupo precisa de pelo menos um administrador');
    }

    return this.#groupRepo.saveMember({ ...member, role });
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

  async createPlayer(
    name: string,
    gender: Gender,
    birthDate: string | null = null,
  ): Promise<Player> {
    const player: Player = {
      id: crypto.randomUUID(),
      name,
      gender,
      birthDate,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return this.#playerRepo.save(player);
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
    const sessions = await this.#sessionRepo.getAll();
    return sessions
      .filter((session) => session.groupId === groupId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  /** A sessão de hoje do grupo, se um admin já a abriu. */
  async getTodaySession(groupId: string): Promise<Session | undefined> {
    const today = this.getLocalDateString();
    const sessions = await this.#sessionRepo.getAll();
    return sessions.find((session) => session.groupId === groupId && session.date === today);
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
      const session = await this.#sessionRepo.getById(tournament.sessionId);
      if (session) {
        session.tournamentIds = session.tournamentIds.filter((tid) => tid !== id);
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
    const [sessions, members] = await Promise.all([
      this.getSessionsByGroupId(groupId),
      this.#groupRepo.getMembersByGroupId(groupId),
    ]);

    return {
      sessionIds: new Set(sessions.map((session) => session.id)),
      playerIds: new Set(members.map((member) => member.playerId)),
    };
  }

  /** Jogadores de um grupo, numa leitura só (§7.12). */
  async getPlayersByGroupId(groupId: string): Promise<Player[]> {
    const [members, players] = await Promise.all([
      this.#groupRepo.getMembersByGroupId(groupId),
      this.#playerRepo.getAll(),
    ]);
    const memberIds = new Set(members.map((member) => member.playerId));
    return players
      .filter((player) => memberIds.has(player.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
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
    const data = await this.#dbService.exportAll();
    return JSON.stringify(data, null, 2);
  }
}
