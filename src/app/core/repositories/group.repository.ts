import { Injectable, inject } from '@angular/core';
import { IndexedDbService } from '../database/indexed-db.service';
import { STORES } from '../database/database.config';
import { Group, GroupMember } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class GroupRepository {
  private db = inject(IndexedDbService);

  async getAll(): Promise<Group[]> {
    return this.db.getAll<Group>(STORES.GROUPS);
  }

  async getById(id: string): Promise<Group | undefined> {
    return this.db.getById<Group>(STORES.GROUPS, id);
  }

  async save(group: Group): Promise<Group> {
    return this.db.put<Group>(STORES.GROUPS, group);
  }

  async getAllMembers(): Promise<GroupMember[]> {
    return this.db.getAll<GroupMember>(STORES.GROUP_MEMBERS);
  }

  async getMembersByGroupId(groupId: string): Promise<GroupMember[]> {
    return this.db.getByIndex<GroupMember>(STORES.GROUP_MEMBERS, 'groupId', groupId);
  }

  async getMembershipsByPlayerId(playerId: string): Promise<GroupMember[]> {
    return this.db.getByIndex<GroupMember>(STORES.GROUP_MEMBERS, 'playerId', playerId);
  }

  async saveMember(member: GroupMember): Promise<GroupMember> {
    return this.db.put<GroupMember>(STORES.GROUP_MEMBERS, member);
  }
}
