import { Injectable, computed, inject, signal } from '@angular/core';
import { AppFacade } from '../facade/app.facade';
import { MockIdentityService } from '../mock/mock-identity.service';
import { Group, GroupRole, Player } from '../../shared/models';

/**
 * O grupo em que o app está e o papel de quem está usando.
 *
 * O papel vale por grupo: a mesma pessoa é admin no Vôlei Trabalho e jogador no
 * Vôlei Segunda. Quem está logado vem do mock de identidade até o ticket 19
 * ligar o `auth.uid()` do Supabase.
 */
@Injectable({ providedIn: 'root' })
export class CurrentGroupStore {
  private readonly facade = inject(AppFacade);
  private readonly identity = inject(MockIdentityService);

  readonly group = signal<Group | null>(null);
  readonly role = signal<GroupRole | null>(null);
  readonly admins = signal<readonly Player[]>([]);
  readonly me = signal<Player | null>(null);

  /** Para quem o estado atual foi carregado: trocar de pessoa invalida tudo. */
  private loadedFor: string | null = null;

  readonly groupId = computed(() => this.group()?.id ?? null);
  readonly playerId = computed(() => this.identity.playerId());
  readonly isAdmin = computed(() => this.role() === 'admin');

  /** "Rafa ou Duda", para os textos de quem corrige um placar. */
  readonly adminNames = computed(() => {
    const names = this.admins().map((admin) => admin.name);
    if (names.length <= 1) {
      return names[0] ?? 'um admin';
    }
    return `${names.slice(0, -1).join(', ')} ou ${names[names.length - 1]}`;
  });

  /** Carrega o grupo e resolve o papel. Devolve `false` se não for membro. */
  async enter(groupId: string): Promise<boolean> {
    const playerId = this.identity.playerId();

    if (this.group()?.id === groupId && this.loadedFor === playerId) {
      return true;
    }
    const [group, members, players] = await Promise.all([
      this.facade.getGroupById(groupId),
      this.facade.getGroupMembers(groupId),
      this.facade.getPlayers(),
    ]);

    const membership = members.find((member) => member.playerId === playerId);
    if (!group || !membership) {
      this.clear();
      return false;
    }

    const byId = new Map(players.map((player) => [player.id, player]));
    this.loadedFor = playerId;
    this.group.set(group);
    this.role.set(membership.role);
    this.me.set(byId.get(playerId) ?? null);
    this.admins.set(
      members
        .filter((member) => member.role === 'admin')
        .map((member) => byId.get(member.playerId))
        .filter((player): player is Player => !!player),
    );

    return true;
  }

  clear(): void {
    this.loadedFor = null;
    this.group.set(null);
    this.role.set(null);
    this.admins.set([]);
    this.me.set(null);
  }
}
