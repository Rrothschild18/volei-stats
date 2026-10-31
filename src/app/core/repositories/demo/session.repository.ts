import { Injectable, inject } from '@angular/core';
import { SessionRepository } from '../repository.contracts';
import { DemoDbService, STORES } from '../../demo/demo-db.service';
import { Session } from '../../../shared/models';

@Injectable()
export class DemoSessionRepository extends SessionRepository {
  private db = inject(DemoDbService);

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
}
