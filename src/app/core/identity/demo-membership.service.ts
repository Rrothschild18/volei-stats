import { Injectable } from '@angular/core';
import {
  ClaimResult,
  CreatedGroup,
  Invite,
  MembershipService,
  UnclaimedPlayer,
} from './membership.service';

/**
 * No modo demonstração não se entra em vôlei nenhum: o cenário de exemplo já
 * começa dentro de dois, e quem está usando é a pessoa escolhida no trocador.
 *
 * Não existe aqui uma imitação do fluxo de entrada de propósito: ele depende da
 * data funcionar como senha dentro do servidor, e uma versão de mentira disso
 * seria uma versão sem a parte que importa.
 */
@Injectable()
export class DemoMembershipService implements MembershipService {
  readonly available = false;

  createGroup(): Promise<CreatedGroup> {
    return this.unavailable();
  }

  redeemCode(): Promise<{ groupId: string; groupName: string }> {
    return this.unavailable();
  }

  unclaimedPlayers(): Promise<readonly UnclaimedPlayer[]> {
    return Promise.resolve([]);
  }

  claim(): Promise<ClaimResult> {
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

  resetBirthDate(): Promise<void> {
    return this.unavailable();
  }

  transferOwnership(): Promise<void> {
    return this.unavailable();
  }

  private unavailable(): never {
    throw new Error('No modo demonstração não dá para entrar nem criar vôlei.');
  }
}
