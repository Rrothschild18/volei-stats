import { Injectable, computed, inject, signal } from '@angular/core';
import { AppFacade } from '../facade/app.facade';
import { IdentityService } from '../identity';
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
 * Quem está usando vem de `IdentityService`: no banco, da sessão anônima deste
 * navegador cruzada com `group_members`; no modo demonstração, da pessoa
 * escolhida no trocador.
 */
@Injectable({ providedIn: 'root' })
export class CurrentGroupStore {
  private readonly facade = inject(AppFacade);
  private readonly identity = inject(IdentityService);

  readonly group = signal<Group | null>(null);
  readonly role = signal<GroupRole | null>(null);
  readonly owner = signal<Player | null>(null);
  readonly me = signal<Player | null>(null);

  /** Para quem o estado atual foi carregado: trocar de pessoa invalida tudo. */
  private loadedFor: string | null = null;

  readonly groupId = computed(() => this.group()?.id ?? null);
  /** Quem eu sou NESTE vôlei. Nulo se ainda não disse. */
  readonly playerId = computed(() => this.me()?.id ?? null);

  /** Já reivindicou um nome: faz o jogo inteiro. */
  readonly canPlay = computed(() => this.role() === 'player');

  /** É o dono: cadastra quem existe e apaga o que desaparece. */
  readonly isOwner = signal(false);

  /** "Rafa", para os textos que falam de quem cadastra e quem apaga. */
  readonly ownerName = computed(() => this.owner()?.name ?? 'o dono');

  /** Carrega o vôlei e resolve o papel. Devolve `false` se não for membro. */
  async enter(groupId: string): Promise<boolean> {
    const membership = await this.identity.myGroup(groupId);
    if (!membership) {
      this.clear();
      return false;
    }

    // Trocar de pessoa invalida o que já estava carregado, e "a mesma pessoa"
    // inclui o caso de ela ainda não ter dito quem é.
    const key = `${groupId}:${membership.playerId ?? 'visitante'}`;
    if (this.loadedFor === key) {
      return true;
    }

    const [group, players] = await Promise.all([
      this.facade.getGroupById(groupId),
      this.facade.getPlayersByGroupId(groupId),
    ]);
    if (!group) {
      this.clear();
      return false;
    }

    const byId = new Map(players.map((player) => [player.id, player]));
    this.loadedFor = key;
    this.group.set(group);
    this.role.set(membership.role);
    this.isOwner.set(membership.isOwner);
    this.me.set(membership.playerId ? (byId.get(membership.playerId) ?? null) : null);
    this.owner.set(byId.get(group.ownerPlayerId) ?? null);

    return true;
  }

  clear(): void {
    this.loadedFor = null;
    this.group.set(null);
    this.role.set(null);
    this.isOwner.set(false);
    this.owner.set(null);
    this.me.set(null);
  }
}
