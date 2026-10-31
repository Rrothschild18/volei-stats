import { Injectable, inject } from '@angular/core';
import { GroupRepository } from '../repository.contracts';
import { DemoDbService, STORES } from '../../demo/demo-db.service';
import { Group, GroupMember } from '../../../shared/models';

@Injectable()
export class DemoGroupRepository extends GroupRepository {
  private db = inject(DemoDbService);

  override async getById(id: string): Promise<Group | undefined> {
    return this.db.getById<Group>(STORES.GROUPS, id);
  }

  override async getMembersByGroupId(groupId: string): Promise<GroupMember[]> {
    return this.db.getByIndex<GroupMember>(STORES.GROUP_MEMBERS, 'groupId', groupId);
  }

  override async getMembershipsByPlayerId(playerId: string): Promise<GroupMember[]> {
    return this.db.getByIndex<GroupMember>(STORES.GROUP_MEMBERS, 'playerId', playerId);
  }
}
