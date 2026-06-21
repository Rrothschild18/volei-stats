import { Injectable, inject } from '@angular/core';
import { IndexedDbService } from '../database/indexed-db.service';
import { STORES } from '../database/database.config';
import { Tournament } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class TournamentRepository {
  private db = inject(IndexedDbService);

  async getAll(): Promise<Tournament[]> {
    return this.db.getAll<Tournament>(STORES.TOURNAMENTS);
  }

  async getBySessionId(sessionId: string): Promise<Tournament[]> {
    return this.db.getByIndex<Tournament>(STORES.TOURNAMENTS, 'sessionId', sessionId);
  }

  async getById(id: string): Promise<Tournament | undefined> {
    return this.db.getById<Tournament>(STORES.TOURNAMENTS, id);
  }

  async save(tournament: Tournament): Promise<Tournament> {
    return this.db.put<Tournament>(STORES.TOURNAMENTS, tournament);
  }

  async delete(id: string): Promise<void> {
    return this.db.delete(STORES.TOURNAMENTS, id);
  }
}
