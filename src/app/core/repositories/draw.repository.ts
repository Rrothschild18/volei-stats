import { Injectable, inject } from '@angular/core';
import { IndexedDbService } from '../database/indexed-db.service';
import { STORES } from '../database/database.config';
import { DrawProposal } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class DrawRepository {
  private db = inject(IndexedDbService);

  async getAll(): Promise<DrawProposal[]> {
    return this.db.getAll<DrawProposal>(STORES.DRAWS);
  }

  async getBySessionId(sessionId: string): Promise<DrawProposal[]> {
    return this.db.getByIndex<DrawProposal>(STORES.DRAWS, 'sessionId', sessionId);
  }

  async getById(id: string): Promise<DrawProposal | undefined> {
    return this.db.getById<DrawProposal>(STORES.DRAWS, id);
  }

  async save(draw: DrawProposal): Promise<DrawProposal> {
    return this.db.put<DrawProposal>(STORES.DRAWS, draw);
  }

  async delete(id: string): Promise<void> {
    return this.db.delete(STORES.DRAWS, id);
  }
}
