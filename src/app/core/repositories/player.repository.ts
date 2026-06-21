import { Injectable, inject } from '@angular/core';
import { IndexedDbService } from '../database/indexed-db.service';
import { STORES } from '../database/database.config';
import { Player } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class PlayerRepository {
  private db = inject(IndexedDbService);

  async getAll(): Promise<Player[]> {
    return this.db.getAll<Player>(STORES.PLAYERS);
  }

  async getActive(): Promise<Player[]> {
    return this.db.getByIndex<Player>(STORES.PLAYERS, 'active', 1 as unknown as IDBValidKey);
  }

  async getById(id: string): Promise<Player | undefined> {
    return this.db.getById<Player>(STORES.PLAYERS, id);
  }

  async save(player: Player): Promise<Player> {
    return this.db.put<Player>(STORES.PLAYERS, player);
  }

  async delete(id: string): Promise<void> {
    return this.db.delete(STORES.PLAYERS, id);
  }
}
