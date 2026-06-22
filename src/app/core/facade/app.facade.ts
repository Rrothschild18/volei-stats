import { Injectable, inject } from '@angular/core';
import { PlayerRepository } from '../repositories/player.repository';
import { SessionRepository } from '../repositories/session.repository';
import { DrawRepository } from '../repositories/draw.repository';
import { TournamentRepository } from '../repositories/tournament.repository';
import { MatchRepository } from '../repositories/match.repository';
import { StatisticsService } from '../services/statistics.service';
import { IndexedDbService } from '../database/indexed-db.service';
import {
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
  readonly #playerRepo = inject(PlayerRepository);
  readonly #sessionRepo = inject(SessionRepository);
  readonly #drawRepo = inject(DrawRepository);
  readonly #tournamentRepo = inject(TournamentRepository);
  readonly #matchRepo = inject(MatchRepository);
  readonly #statsService = inject(StatisticsService);
  readonly #dbService = inject(IndexedDbService);

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

  async createPlayer(name: string, gender: Gender): Promise<Player> {
    const player: Player = {
      id: crypto.randomUUID(),
      name,
      gender,
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

  async createSession(playerIds: string[]): Promise<Session> {
    const session: Session = {
      id: crypto.randomUUID(),
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
