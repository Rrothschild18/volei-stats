import { Injectable, inject } from '@angular/core';
import { Gender } from '../../shared/enums';
import { SupabaseService } from '../supabase/supabase.service';
import {
  ClaimFailure,
  ClaimResult,
  CreatedGroup,
  Invite,
  MembershipService,
  UnclaimedPlayer,
} from './membership.service';

/** Os motivos que `claim_player` devolve, no vocabulário do app. */
const FAILURES: Record<string, ClaimFailure> = {
  not_found: 'not-found',
  new_birth_date_required: 'new-date-required',
  new_birth_date_must_differ: 'new-date-must-differ',
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
    initialBirthDate: string;
  }): Promise<CreatedGroup> {
    const client = await this.ready();
    const { data, error } = await client.rpc('create_group', {
      p_group_name: input.groupName,
      p_owner_name: input.ownerName,
      p_owner_gender: input.ownerGender,
      p_owner_birth_date: input.ownerBirthDate,
      p_initial_birth_date: input.initialBirthDate,
    });
    if (error) {
      throw new Error(this.readable(error.message));
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

  async redeemCode(code: string): Promise<{ groupId: string; groupName: string }> {
    const client = await this.ready();
    const { data, error } = await client.rpc('redeem_invite_code', { p_code: code });
    if (error) {
      throw new Error(this.readable(error.message));
    }
    const row = data?.[0];
    if (!row) {
      throw new Error('Código inválido');
    }
    return { groupId: row.group_id, groupName: row.group_name };
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
    birthDate: string;
    newBirthDate: string | null;
  }): Promise<ClaimResult> {
    const client = await this.ready();
    const { data, error } = await client.rpc('claim_player', {
      p_group_id: input.groupId,
      p_name: input.name,
      p_birth_date: input.birthDate,
      p_new_birth_date: input.newBirthDate ?? undefined,
    });
    if (error) {
      throw new Error(this.readable(error.message));
    }
    if (!data?.ok || !data.player_id) {
      return { ok: false, failure: FAILURES[data?.reason ?? ''] ?? 'not-found' };
    }
    return { ok: true, playerId: data.player_id };
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
    const { data, error } = await client
      .from('invites')
      .update({ code })
      .eq('group_id', groupId)
      .is('revoked_at', null)
      .select('code')
      .single();
    if (error) {
      throw new Error(this.readable(error.message));
    }
    return { code: data.code, revoked: false };
  }

  async renewInvite(groupId: string): Promise<Invite> {
    const client = await this.ready();
    const { error: revokeError } = await client
      .from('invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('group_id', groupId)
      .is('revoked_at', null);
    if (revokeError) {
      throw new Error(`Não foi possível cancelar o convite: ${revokeError.message}`);
    }

    const { data, error } = await client
      .from('invites')
      .insert({ group_id: groupId, label: 'Link do vôlei' })
      .select('code')
      .single();
    if (error) {
      throw new Error(`Não foi possível gerar outro convite: ${error.message}`);
    }
    return { code: data.code, revoked: false };
  }

  async resetBirthDate(playerId: string): Promise<void> {
    const client = await this.ready();
    const { error } = await client.rpc('reset_player_birth_date', { p_player_id: playerId });
    if (error) {
      throw new Error(this.readable(error.message));
    }
  }

  async transferOwnership(groupId: string, playerId: string): Promise<void> {
    const client = await this.ready();
    const { error } = await client.rpc('transfer_ownership', {
      p_group_id: groupId,
      p_player_id: playerId,
    });
    if (error) {
      throw new Error(this.readable(error.message));
    }
  }

  private async ready() {
    await this.supabase.ensureSession();
    return this.supabase.client;
  }

  /**
   * As mensagens do banco já vêm escritas para a pessoa ler — as funções usam
   * `raise exception` com texto em português. O que não vem é o caso do código
   * repetido, que chega como violação de unicidade.
   */
  private readable(message: string): string {
    if (message.includes('invites_code_key')) {
      return 'Esse código já está em uso por outro vôlei. Escolha outro.';
    }
    if (message.includes('invites_code_shape')) {
      return 'O código aceita letras, números e hífen, com pelo menos 3 caracteres.';
    }
    return message;
  }
}
