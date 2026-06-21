import { Injectable, inject } from '@angular/core';
import { IndexedDbService } from '../database/indexed-db.service';
import { STORES } from '../database/database.config';
import { Session } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class SessionRepository {
  private db = inject(IndexedDbService);

  async getAll(): Promise<Session[]> {
    return this.db.getAll<Session>(STORES.SESSIONS);
  }

  async getById(id: string): Promise<Session | undefined> {
    return this.db.getById<Session>(STORES.SESSIONS, id);
  }

  async save(session: Session): Promise<Session> {
    return this.db.put<Session>(STORES.SESSIONS, session);
  }

  async delete(id: string): Promise<void> {
    return this.db.delete(STORES.SESSIONS, id);
  }
}
