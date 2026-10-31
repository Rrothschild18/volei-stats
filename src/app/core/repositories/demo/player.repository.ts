import { Injectable, inject } from '@angular/core';
import { PlayerRepository } from '../repository.contracts';
import { DemoDbService, STORES } from '../../demo/demo-db.service';
import { Gender } from '../../../shared/enums';
import { GroupMember, Player } from '../../../shared/models';

@Injectable()
export class DemoPlayerRepository extends PlayerRepository {
  private db = inject(DemoDbService);

  override async getAll(): Promise<Player[]> {
    return this.db.getAll<Player>(STORES.PLAYERS);
  }

  override async create(groupId: string, name: string, gender: Gender): Promise<Player> {
    const now = new Date().toISOString();
    const player = await this.save({
      id: crypto.randomUUID(),
      groupId,
      name,
      gender,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    // E entra na lista de membros, que é o que responde "quem joga aqui" neste
    // modo (ver `getByGroupId`). Sem esta linha, cadastrar parecia funcionar e a
    // pessoa não aparecia em lugar nenhum — nem na presença, nem no ranking.
    await this.db.put<GroupMember>(STORES.GROUP_MEMBERS, {
      id: `${groupId}:${player.id}`,
      groupId,
      playerId: player.id,
      role: 'player',
    });

    return player;
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
}
