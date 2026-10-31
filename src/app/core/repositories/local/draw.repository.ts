import { Injectable, inject } from '@angular/core';
import { DrawRepository } from '../repository.contracts';
import { IndexedDbService } from '../../database/indexed-db.service';
import { STORES } from '../../database/database.config';
import { DrawProposal } from '../../../shared/models';

@Injectable()
export class LocalDrawRepository extends DrawRepository {
  private db = inject(IndexedDbService);

  override async getAll(): Promise<DrawProposal[]> {
    return this.db.getAll<DrawProposal>(STORES.DRAWS);
  }

  override async getBySessionId(sessionId: string): Promise<DrawProposal[]> {
    return this.db.getByIndex<DrawProposal>(STORES.DRAWS, 'sessionId', sessionId);
  }

  override async getById(id: string): Promise<DrawProposal | undefined> {
    return this.db.getById<DrawProposal>(STORES.DRAWS, id);
  }

  override async save(draw: DrawProposal): Promise<DrawProposal> {
    return this.db.put<DrawProposal>(STORES.DRAWS, draw);
  }

  override async delete(id: string): Promise<void> {
    return this.db.delete(STORES.DRAWS, id);
  }
}
