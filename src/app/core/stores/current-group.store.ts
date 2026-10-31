import { Injectable, computed, inject, signal } from '@angular/core';
import { AppFacade } from '../facade/app.facade';
import { MockIdentityService } from '../mock/mock-identity.service';
import { Group, GroupRole, Player } from '../../shared/models';

/**
 * O vôlei em que o app está, e o que quem está usando pode fazer nele.
 *
 * São duas perguntas diferentes, e misturá-las foi o erro do modelo anterior:
 *
 *   `canPlay` — já disse quem é? Então marca presença, sorteia, cria
 *               campeonato, lança e corrige placar, decide par-ou-ímpar. O
 *               jogo é de todos porque o dono pode estar jogando a final.
 *   `isOwner` — criou o vôlei (ou o recebeu)? Então cadastra gente, gera o
 *               link e apaga coisa.
 *
 * Quem está usando vem do mock de identidade até o ticket 20 ligar o
 * `auth.uid()` do Supabase.
 */
@Injectable({ providedIn: 'root' })
export class CurrentGroupStore {
  private readonly facade = inject(AppFacade);
  private readonly identity = inject(MockIdentityService);

  readonly group = signal<Group | null>(null);
  readonly role = signal<GroupRole | null>(null);
  readonly owner = signal<Player | null>(null);
  readonly me = signal<Player | null>(null);

  /** Para quem o estado atual foi carregado: trocar de pessoa invalida tudo. */
  private loadedFor: string | null = null;

  readonly groupId = computed(() => this.group()?.id ?? null);
  readonly playerId = computed(() => this.identity.playerId());

  /** Já reivindicou um nome: faz o jogo inteiro. */
  readonly canPlay = computed(() => this.role() === 'player');

  /** É o dono: cadastra quem existe e apaga o que desaparece. */
  readonly isOwner = computed(() => {
    const me = this.me();
    const group = this.group();
    return !!me && !!group && me.id === group.ownerPlayerId;
  });

  /** "Rafa", para os textos que falam de quem cadastra e quem apaga. */
  readonly ownerName = computed(() => this.owner()?.name ?? 'o dono');

  /** Carrega o vôlei e resolve o papel. Devolve `false` se não for membro. */
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
    this.owner.set(byId.get(group.ownerPlayerId) ?? null);

    return true;
  }

  clear(): void {
    this.loadedFor = null;
    this.group.set(null);
    this.role.set(null);
    this.owner.set(null);
    this.me.set(null);
  }
}
