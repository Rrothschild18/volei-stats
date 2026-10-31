import { Injectable, inject } from '@angular/core';
import { Gender } from '../../shared/enums';
import { AppFacade } from '../facade/app.facade';
import { DEMO_PLAYER_ID } from './demo-seed';
import {
  BirthDateResult,
  ClaimResult,
  CreatedGroup,
  Invite,
  MembershipService,
  UnclaimedPlayer,
} from '../identity';

/**
 * No modo demonstração não se entra em vôlei nenhum: o cenário de exemplo já
 * começa dentro de dois, e quem está usando é uma pessoa fixa.
 *
 * Não existe aqui uma imitação do fluxo de entrada de propósito: ele depende da
 * data funcionar como senha dentro do servidor, e uma versão de mentira disso
 * seria uma versão sem a parte que importa.
 */
@Injectable()
export class DemoMembershipService implements MembershipService {
  private readonly facade = inject(AppFacade);

  readonly available = false;

  createGroup(): Promise<CreatedGroup> {
    return this.unavailable();
  }

  redeemCode(): Promise<{ groupId: string; groupName: string }> {
    return this.unavailable();
  }

  /**
   * Esta responde de verdade, e não com uma lista vazia: é ela que diz à lista
   * de jogadores quem foi cadastrado e ainda não disse quem é. Devolver vazio
   * aqui faria a tela parecer certa e esconder a etiqueta sempre.
   */
  async unclaimedPlayers(groupId: string): Promise<readonly UnclaimedPlayer[]> {
    const [players, membros] = await Promise.all([
      this.facade.getPlayersByGroupId(groupId),
      this.facade.getGroupMembers(groupId),
    ]);
    const comDono = new Set(membros.map((membro) => membro.playerId));

    return players
      .filter((player) => player.active && !comDono.has(player.id))
      .map((player) => ({ id: player.id, name: player.name, gender: player.gender as Gender }));
  }

  claim(): Promise<ClaimResult> {
    return this.unavailable();
  }

  claimAgain(): Promise<ClaimResult> {
    return this.unavailable();
  }

  setJoinPassword(): Promise<void> {
    return this.unavailable();
  }

  /**
   * Trocar o nome funciona aqui: é escrita comum, e o cenário em memória a
   * aceita. É o que deixa a tela "Seus dados" ser testada na metade rápida.
   */
  async renameMe(groupId: string, name: string): Promise<void> {
    const eu = await this.facade.getPlayerById(this.euId(groupId));
    if (!eu) {
      throw new Error('Você ainda não disse quem é neste vôlei.');
    }
    await this.facade.updatePlayer({ ...eu, name });
  }

  /** A data é senha, e senha só existe contra o servidor. */
  changeMyBirthDate(): Promise<BirthDateResult> {
    return this.unavailable();
  }

  invite(): Promise<Invite | null> {
    return Promise.resolve(null);
  }

  setInviteCode(): Promise<Invite> {
    return this.unavailable();
  }

  renewInvite(): Promise<Invite> {
    return this.unavailable();
  }

  resetAccess(): Promise<void> {
    return this.unavailable();
  }

  transferOwnership(): Promise<void> {
    return this.unavailable();
  }

  private euId(groupId: string): string {
    void groupId;
    return DEMO_PLAYER_ID;
  }

  private unavailable(): never {
    throw new Error('No modo demonstração não dá para entrar nem criar vôlei.');
  }
}
