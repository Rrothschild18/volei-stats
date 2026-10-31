import { Injectable, inject } from '@angular/core';
import { Gender } from '../../shared/enums';
import { SupabaseService } from '../supabase/supabase.service';
import {
  BirthDateFailure,
  BirthDateResult,
  ClaimFailure,
  ClaimResult,
  CreatedGroup,
  Invite,
  MembershipService,
  UnclaimedPlayer,
} from './membership.service';

/**
 * Os motivos que `redeem_invite_code` devolve, em frases.
 *
 * "Código inválido" vale também para vôlei que não existe: o código não conta se
 * há um vôlei do outro lado.
 */
const CODE_FAILURES: Record<string, string> = {
  not_found: 'Código inválido',
  revoked: 'Este convite foi cancelado',
  expired: 'Este convite expirou',
  rate_limited: 'Muitas tentativas. Espere alguns minutos.',
};

/** Os motivos de `change_my_birth_date`, no vocabulário do app. */
const BIRTH_DATE_FAILURES: Record<string, BirthDateFailure> = {
  wrong_current: 'wrong-current',
  rate_limited: 'too-many-tries',
};

/** Os motivos que `claim_player` devolve, no vocabulário do app. */
const FAILURES: Record<string, ClaimFailure> = {
  not_found: 'not-found',
  birth_date_required: 'birth-date-required',
  rate_limited: 'too-many-tries',
};

@Injectable()
export class SupabaseMembershipService implements MembershipService {
  private readonly supabase = inject(SupabaseService);

  readonly available = true;

  async createGroup(input: {
    groupName: string;
    ownerName: string;
    ownerGender: Gender;
    ownerBirthDate: string;
    joinPassword: string;
  }): Promise<CreatedGroup> {
    const client = await this.ready();
    const { data, error } = await client.rpc('create_group', {
      p_group_name: input.groupName,
      p_owner_name: input.ownerName,
      p_owner_gender: input.ownerGender,
      p_owner_birth_date: input.ownerBirthDate,
      p_join_password: input.joinPassword,
    });
    if (error) {
      throw new Error(error.message);
    }
    const row = data?.[0];
    if (!row) {
      throw new Error('O vôlei não foi criado');
    }
    return {
      groupId: row.group_id,
      playerId: row.player_id,
      inviteCode: row.invite_code,
    };
  }

  /**
   * O banco devolve MOTIVO em vez de lançar exceção, para que o registro da
   * tentativa não seja desfeito junto — então é aqui que o motivo vira frase.
   */
  async redeemCode(code: string): Promise<{ groupId: string; groupName: string }> {
    const client = await this.ready();
    const { data, error } = await client.rpc('redeem_invite_code', { p_code: code });
    if (error) {
      throw new Error(error.message);
    }

    const row = data?.[0];
    const reason = row?.reason ?? 'not_found';
    if (reason !== 'ok' || !row?.group_id) {
      throw new Error(CODE_FAILURES[reason] ?? CODE_FAILURES['not_found']);
    }
    return { groupId: row.group_id, groupName: row.group_name ?? '' };
  }

  async unclaimedPlayers(groupId: string): Promise<readonly UnclaimedPlayer[]> {
    const client = await this.ready();
    const { data, error } = await client.rpc('unclaimed_players', { p_group_id: groupId });
    if (error) {
      throw new Error(`Não foi possível ler os nomes: ${error.message}`);
    }
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      gender: row.gender as Gender,
    }));
  }

  /**
   * Devolve motivo em vez de lançar erro, e isso é do banco: um `raise`
   * desfaria o registro da tentativa, e a trava de força bruta nunca contaria
   * nada.
   */
  async claim(input: {
    groupId: string;
    name: string;
    password: string;
    birthDate: string;
  }): Promise<ClaimResult> {
    const client = await this.ready();
    const { data, error } = await client.rpc('claim_player', {
      p_group_id: input.groupId,
      p_name: input.name,
      p_password: input.password,
      p_birth_date: input.birthDate,
    });
    return this.toClaimResult(data, error);
  }

  async claimAgain(input: {
    groupId: string;
    name: string;
    birthDate: string;
  }): Promise<ClaimResult> {
    const client = await this.ready();
    const { data, error } = await client.rpc('claim_player_again', {
      p_group_id: input.groupId,
      p_name: input.name,
      p_birth_date: input.birthDate,
    });
    return this.toClaimResult(data, error);
  }

  private toClaimResult(
    data: { ok: boolean | null; reason: string | null; player_id: string | null } | null,
    error: { message: string } | null,
  ): ClaimResult {
    if (error) {
      throw new Error(error.message);
    }
    if (!data?.ok || !data.player_id) {
      return { ok: false, failure: FAILURES[data?.reason ?? ''] ?? 'not-found' };
    }
    return { ok: true, playerId: data.player_id };
  }

  async renameMe(groupId: string, name: string): Promise<void> {
    const client = await this.ready();
    const { error } = await client.rpc('rename_me', { p_group_id: groupId, p_name: name });
    if (error) {
      throw new Error(error.message);
    }
  }

  async changeMyBirthDate(input: {
    groupId: string;
    current: string;
    next: string;
  }): Promise<BirthDateResult> {
    const client = await this.ready();
    const { data, error } = await client.rpc('change_my_birth_date', {
      p_group_id: input.groupId,
      p_current: input.current,
      p_new: input.next,
    });
    if (error) {
      throw new Error(error.message);
    }
    return data === 'ok'
      ? { ok: true }
      : { ok: false, failure: BIRTH_DATE_FAILURES[data ?? ''] ?? 'wrong-current' };
  }

  async invite(groupId: string): Promise<Invite | null> {
    const client = await this.ready();
    const { data, error } = await client
      .from('invites')
      .select('code, revoked_at')
      .eq('group_id', groupId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(`Não foi possível ler o convite: ${error.message}`);
    }
    return data ? { code: data.code, revoked: false } : null;
  }

  async setInviteCode(groupId: string, code: string): Promise<Invite> {
    const current = await this.invite(groupId);
    if (!current) {
      throw new Error('Este vôlei não tem convite aberto');
    }
    const client = await this.ready();
    // `limit(1)` e não `single()`: se o vôlei tiver dois convites abertos — um
    // toque duplo em "gerar", um `renewInvite` que revogou e não inseriu —, o
    // update funcionaria e a resposta estouraria com "multiple rows returned",
    // dizendo que falhou algo que aconteceu.
    const { data, error } = await client
      .from('invites')
      .update({ code })
      .eq('group_id', groupId)
      .is('revoked_at', null)
      .select('code')
      .limit(1);
    if (error) {
      throw new Error(error.message);
    }
    return { code: data?.[0]?.code ?? code, revoked: false };
  }

  /**
   * Insere o convite novo ANTES de cancelar os antigos.
   *
   * Na ordem inversa, um insert que falhasse (sem rede, teto de tempo) deixava
   * o vôlei sem convite nenhum: o código velho morto e nenhum novo no lugar. O
   * pior momento para isso é exatamente quando se cancela um convite — alguém
   * entrou que não devia.
   */
  async renewInvite(groupId: string): Promise<Invite> {
    const client = await this.ready();
    const { data, error } = await client
      .from('invites')
      .insert({ group_id: groupId, label: 'Link do vôlei' })
      .select('token, code')
      .single();
    if (error) {
      throw new Error(`Não foi possível gerar outro convite: ${error.message}`);
    }

    const { error: revokeError } = await client
      .from('invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('group_id', groupId)
      .is('revoked_at', null)
      .neq('token', data.token);
    if (revokeError) {
      throw new Error(`Não foi possível cancelar o convite antigo: ${revokeError.message}`);
    }

    return { code: data.code, revoked: false };
  }

  async resetAccess(playerId: string): Promise<void> {
    const client = await this.ready();
    const { error } = await client.rpc('reset_player_access', { p_player_id: playerId });
    if (error) {
      throw new Error(error.message);
    }
  }

  async setJoinPassword(groupId: string, password: string): Promise<void> {
    const client = await this.ready();
    const { error } = await client.rpc('set_join_password', {
      p_group_id: groupId,
      p_password: password,
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  async transferOwnership(groupId: string, playerId: string): Promise<void> {
    const client = await this.ready();
    const { error } = await client.rpc('transfer_ownership', {
      p_group_id: groupId,
      p_player_id: playerId,
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  private async ready() {
    await this.supabase.ensureSession();
    return this.supabase.client;
  }
}
