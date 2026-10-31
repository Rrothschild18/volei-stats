import { Injectable, inject } from '@angular/core';
import { MatchRepository } from '../repository.contracts';
import { DemoDbService, STORES } from '../../demo/demo-db.service';
import { Match } from '../../../shared/models';

@Injectable()
export class DemoMatchRepository extends MatchRepository {
  private db = inject(DemoDbService);

  override async getAll(): Promise<Match[]> {
    return this.db.getAll<Match>(STORES.MATCHES);
  }

  override async getByTournamentId(tournamentId: string): Promise<Match[]> {
    return this.db.getByIndex<Match>(STORES.MATCHES, 'tournamentId', tournamentId);
  }

  override async getBySessionId(sessionId: string): Promise<Match[]> {
    return this.db.getByIndex<Match>(STORES.MATCHES, 'sessionId', sessionId);
  }

  override async getById(id: string): Promise<Match | undefined> {
    return this.db.getById<Match>(STORES.MATCHES, id);
  }

  override async save(match: Match): Promise<Match> {
    return this.db.put<Match>(STORES.MATCHES, match);
  }

  override async delete(id: string): Promise<void> {
    return this.db.delete(STORES.MATCHES, id);
  }
}
