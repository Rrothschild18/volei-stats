import { Injectable, inject } from '@angular/core';
import { AppFacade } from '../facade/app.facade';
import { MockIdentityService } from '../mock/mock-identity.service';
import { todayDateString } from '../../shared/utils/date.util';
import { IdentityService, MyGroup } from './identity.service';

/**
 * Quem este navegador é no modo demonstração: a pessoa escolhida no trocador.
 *
 * Monta à mão o que a view `my_groups` entrega pronta no banco.
 */
@Injectable()
export class DemoIdentityService implements IdentityService {
  private readonly facade = inject(AppFacade);
  private readonly mock = inject(MockIdentityService);

  async myGroups(): Promise<readonly MyGroup[]> {
    const playerId = this.mock.playerId();
    const memberships = await this.facade.getMembershipsByPlayerId(playerId);
    const groups: MyGroup[] = [];

    for (const membership of memberships) {
      const [group, members, sessions] = await Promise.all([
        this.facade.getGroupById(membership.groupId),
        this.facade.getGroupMembers(membership.groupId),
        this.facade.getSessionsByGroupId(membership.groupId),
      ]);
      if (!group) {
        continue;
      }
      const today = sessions.find((session) => session.date === todayDateString()) ?? null;

      groups.push({
        groupId: group.id,
        name: group.name,
        role: membership.role,
        playerId: membership.playerId,
        isOwner: group.ownerPlayerId === playerId,
        todaySessionId: today?.id ?? null,
        playerCount: members.length,
        lastSessionDate: sessions[0]?.date ?? null,
      });
    }

    return groups.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  async myGroup(groupId: string): Promise<MyGroup | null> {
    const groups = await this.myGroups();
    return groups.find((group) => group.groupId === groupId) ?? null;
  }

  async forget(): Promise<void> {
    // No modo demonstração a identidade é uma escolha, não uma sessão: nada a
    // esquecer.
  }
}
