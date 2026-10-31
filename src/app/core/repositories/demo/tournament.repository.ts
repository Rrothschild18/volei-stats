import { Injectable, inject } from '@angular/core';
import { TournamentRepository } from '../repository.contracts';
import { DemoDbService, STORES } from '../../demo/demo-db.service';
import { Tournament } from '../../../shared/models';

@Injectable()
export class DemoTournamentRepository extends TournamentRepository {
  private db = inject(DemoDbService);

  override async getAll(): Promise<Tournament[]> {
    return this.db.getAll<Tournament>(STORES.TOURNAMENTS);
  }

  override async getBySessionId(sessionId: string): Promise<Tournament[]> {
    return this.db.getByIndex<Tournament>(STORES.TOURNAMENTS, 'sessionId', sessionId);
  }

  override async getById(id: string): Promise<Tournament | undefined> {
    return this.db.getById<Tournament>(STORES.TOURNAMENTS, id);
  }

  override async save(tournament: Tournament): Promise<Tournament> {
    return this.db.put<Tournament>(STORES.TOURNAMENTS, tournament);
  }

  override async delete(id: string): Promise<void> {
    return this.db.delete(STORES.TOURNAMENTS, id);
  }
}
