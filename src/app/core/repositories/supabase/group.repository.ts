import { Injectable } from '@angular/core';
import { Group, GroupMember, GroupRole } from '../../../shared/models';
import { GroupRepository } from '../repository.contracts';
import { Row, SupabaseRepositoryBase } from './supabase-repository.base';

/**
 * Vôleis e quem participa deles.
 *
 * As políticas do banco já recortam tudo: `getAll()` devolve os vôleis de quem
 * está olhando, e não "todos" — e a lista de membros só é inteira para o dono.
 * Criar vôlei não está aqui: é a função `create_group`, porque criar envolve
 * jogador, dono e convite numa transação só.
 */
@Injectable()
export class SupabaseGroupRepository extends SupabaseRepositoryBase implements GroupRepository {
  async getAll(): Promise<Group[]> {
    const table = await this.table('groups');
    const { data, error } = await table.select('id, name, owner_player_id, created_at');
    return this.unwrap(data, error, 'Não foi possível ler os vôleis').map(toGroup);
  }

  async getById(id: string): Promise<Group | undefined> {
    const table = await this.table('groups');
    const { data, error } = await table
      .select('id, name, owner_player_id, created_at')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new Error(`Não foi possível ler o vôlei: ${error.message}`);
    }
    return data ? toGroup(data) : undefined;
  }

  /** Renomear, e passar o vôlei para outra pessoa. Só o dono consegue. */
  async save(group: Group): Promise<Group> {
    const table = await this.table('groups');
    const { data, error } = await table
      .update({ name: group.name, owner_player_id: group.ownerPlayerId })
      .eq('id', group.id)
      .select('id, name, owner_player_id, created_at')
      .single();
    return toGroup(this.unwrap(data, error, 'Não foi possível salvar o vôlei'));
  }

  async getAllMembers(): Promise<GroupMember[]> {
    const table = await this.table('group_members');
    const { data, error } = await table.select('group_id, user_id, player_id, role');
    return this.unwrap(data, error, 'Não foi possível ler quem participa').map(toMember);
  }

  async getMembersByGroupId(groupId: string): Promise<GroupMember[]> {
    const table = await this.table('group_members');
    const { data, error } = await table
      .select('group_id, user_id, player_id, role')
      .eq('group_id', groupId);
    return this.unwrap(data, error, 'Não foi possível ler quem participa').map(toMember);
  }

  async getMembershipsByPlayerId(playerId: string): Promise<GroupMember[]> {
    const table = await this.table('group_members');
    const { data, error } = await table
      .select('group_id, user_id, player_id, role')
      .eq('player_id', playerId);
    return this.unwrap(data, error, 'Não foi possível ler os seus vôleis').map(toMember);
  }

  /**
   * Quem é dono muda papel de alguém. Dizer quem a pessoa é, não: isso é
   * `claim_player`, que compara a data dentro do servidor.
   */
  async saveMember(member: GroupMember): Promise<GroupMember> {
    const table = await this.table('group_members');
    const { data, error } = await table
      .update({ role: member.role })
      .eq('group_id', member.groupId)
      .eq('player_id', member.playerId ?? '')
      .select('group_id, user_id, player_id, role')
      .single();
    return toMember(this.unwrap(data, error, 'Não foi possível salvar o papel'));
  }
}

type GroupColumns = Pick<Row<'groups'>, 'id' | 'name' | 'owner_player_id' | 'created_at'>;
type MemberColumns = Pick<Row<'group_members'>, 'group_id' | 'user_id' | 'player_id' | 'role'>;

function toGroup(row: GroupColumns): Group {
  return {
    id: row.id,
    name: row.name,
    // Só fica nulo no instante entre o insert do vôlei e o do dono, dentro de
    // `create_group` — nenhum cliente vê esse estado.
    ownerPlayerId: row.owner_player_id ?? '',
    createdAt: row.created_at,
  };
}

function toMember(row: MemberColumns): GroupMember {
  return {
    // A tabela tem chave composta (vôlei + sessão do navegador); o app pede um
    // id, então ele é a composição dos dois.
    id: `${row.group_id}:${row.user_id}`,
    groupId: row.group_id,
    playerId: row.player_id,
    role: row.role as GroupRole,
  };
}
