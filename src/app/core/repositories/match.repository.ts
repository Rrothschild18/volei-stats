import { Injectable, inject } from '@angular/core';
import { IndexedDbService } from '../database/indexed-db.service';
import { STORES } from '../database/database.config';
import { Match } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class MatchRepository {
  private db = inject(IndexedDbService);

  async getAll(): Promise<Match[]> {
    return this.db.getAll<Match>(STORES.MATCHES);
  }

  async getByTournamentId(tournamentId: string): Promise<Match[]> {
    return this.db.getByIndex<Match>(STORES.MATCHES, 'tournamentId', tournamentId);
  }

  async getBySessionId(sessionId: string): Promise<Match[]> {
    return this.db.getByIndex<Match>(STORES.MATCHES, 'sessionId', sessionId);
  }

  async getById(id: string): Promise<Match | undefined> {
    return this.db.getById<Match>(STORES.MATCHES, id);
  }

  async save(match: Match): Promise<Match> {
    return this.db.put<Match>(STORES.MATCHES, match);
  }

  async delete(id: string): Promise<void> {
    return this.db.delete(STORES.MATCHES, id);
  }
}
