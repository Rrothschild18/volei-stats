import { Injectable, inject } from '@angular/core';
import { GroupRepository } from '../repository.contracts';
import { IndexedDbService } from '../../database/indexed-db.service';
import { STORES } from '../../database/database.config';
import { Group, GroupMember } from '../../../shared/models';

@Injectable()
export class LocalGroupRepository extends GroupRepository {
  private db = inject(IndexedDbService);

  override async getAll(): Promise<Group[]> {
    return this.db.getAll<Group>(STORES.GROUPS);
  }

  override async getById(id: string): Promise<Group | undefined> {
    return this.db.getById<Group>(STORES.GROUPS, id);
  }

  override async save(group: Group): Promise<Group> {
    return this.db.put<Group>(STORES.GROUPS, group);
  }

  override async getAllMembers(): Promise<GroupMember[]> {
    return this.db.getAll<GroupMember>(STORES.GROUP_MEMBERS);
  }

  override async getMembersByGroupId(groupId: string): Promise<GroupMember[]> {
    return this.db.getByIndex<GroupMember>(STORES.GROUP_MEMBERS, 'groupId', groupId);
  }

  override async getMembershipsByPlayerId(playerId: string): Promise<GroupMember[]> {
    return this.db.getByIndex<GroupMember>(STORES.GROUP_MEMBERS, 'playerId', playerId);
  }

  override async saveMember(member: GroupMember): Promise<GroupMember> {
    return this.db.put<GroupMember>(STORES.GROUP_MEMBERS, member);
  }
}
