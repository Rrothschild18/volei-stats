import { Injectable, inject } from '@angular/core';
import { PlayerRepository } from '../repository.contracts';
import { IndexedDbService } from '../../database/indexed-db.service';
import { STORES } from '../../database/database.config';
import { Gender } from '../../../shared/enums';
import { GroupMember, Player } from '../../../shared/models';

@Injectable()
export class LocalPlayerRepository extends PlayerRepository {
  private db = inject(IndexedDbService);

  override async getAll(): Promise<Player[]> {
    return this.db.getAll<Player>(STORES.PLAYERS);
  }

  override async create(groupId: string, name: string, gender: Gender): Promise<Player> {
    const now = new Date().toISOString();
    return this.save({
      id: crypto.randomUUID(),
      groupId,
      name,
      gender,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * No modo demonstração quem joga num vôlei vem da lista de membros, e não da
   * coluna `groupId` do jogador: o cenário de exemplo tem gente nos dois
   * vôleis, de propósito, para mostrar as duas visões com uma identidade só.
   */
  override async getByGroupId(groupId: string): Promise<Player[]> {
    const [all, members] = await Promise.all([
      this.getAll(),
      this.db.getByIndex<GroupMember>(STORES.GROUP_MEMBERS, 'groupId', groupId),
    ]);
    const playing = new Set(members.map((member) => member.playerId));
    return all
      .filter((player) => playing.has(player.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  override async getById(id: string): Promise<Player | undefined> {
    return this.db.getById<Player>(STORES.PLAYERS, id);
  }

  override async save(player: Player): Promise<Player> {
    return this.db.put<Player>(STORES.PLAYERS, player);
  }

  override async delete(id: string): Promise<void> {
    return this.db.delete(STORES.PLAYERS, id);
  }
}
