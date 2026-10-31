import { Injectable, inject } from '@angular/core';
import { SessionRepository } from '../repository.contracts';
import { IndexedDbService } from '../../database/indexed-db.service';
import { STORES } from '../../database/database.config';
import { Session } from '../../../shared/models';

@Injectable()
export class LocalSessionRepository extends SessionRepository {
  private db = inject(IndexedDbService);

  override async getAll(): Promise<Session[]> {
    return this.db.getAll<Session>(STORES.SESSIONS);
  }

  override async getByGroupId(groupId: string): Promise<Session[]> {
    const all = await this.getAll();
    return all
      .filter((session) => session.groupId === groupId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  override async getById(id: string): Promise<Session | undefined> {
    return this.db.getById<Session>(STORES.SESSIONS, id);
  }

  override async save(session: Session): Promise<Session> {
    return this.db.put<Session>(STORES.SESSIONS, session);
  }

  override async delete(id: string): Promise<void> {
    return this.db.delete(STORES.SESSIONS, id);
  }
}
