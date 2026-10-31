import { Injectable } from '@angular/core';
import { Gender } from '../../../shared/enums';
import { Player } from '../../../shared/models';
import { PlayerRepository } from '../repository.contracts';
import { Row, SupabaseRepositoryBase } from './supabase-repository.base';

/**
 * Os jogadores de cada vôlei.
 *
 * A data de nascimento não aparece em nenhuma consulta daqui porque o banco não
 * a entrega: o privilégio de coluna foi revogado. Ela é senha, e senha só é
 * comparada do lado do servidor.
 */
@Injectable()
export class SupabasePlayerRepository extends SupabaseRepositoryBase implements PlayerRepository {
  async getAll(): Promise<Player[]> {
    const table = await this.table('players');
    const { data, error } = await table.select(COLUMNS).order('name');
    return this.unwrap(data, error, 'Não foi possível ler os jogadores').map(toPlayer);
  }

  async getByGroupId(groupId: string): Promise<Player[]> {
    const table = await this.table('players');
    const { data, error } = await table.select(COLUMNS).eq('group_id', groupId).order('name');
    return this.unwrap(data, error, 'Não foi possível ler os jogadores').map(toPlayer);
  }

  async getById(id: string): Promise<Player | undefined> {
    const table = await this.table('players');
    const { data, error } = await table.select(COLUMNS).eq('id', id).maybeSingle();
    if (error) {
      throw new Error(`Não foi possível ler o jogador: ${error.message}`);
    }
    return data ? toPlayer(data) : undefined;
  }

  /**
   * Cadastra pelo servidor, porque o cliente não tem permissão de inserir
   * jogador: a data inicial do vôlei é senha de primeiro acesso, e é o banco
   * que a copia. Só o dono consegue.
   */
  async create(groupId: string, name: string, gender: Gender): Promise<Player> {
    const client = await this.rpc();
    const { data, error } = await client.rpc('add_player', {
      p_group_id: groupId,
      p_name: name,
      p_gender: gender,
    });
    const id = this.unwrap(data, error, 'Não foi possível cadastrar o jogador');
    const created = await this.getById(id as string);
    if (!created) {
      throw new Error('O jogador desapareceu depois de cadastrado');
    }
    return created;
  }

  /** Nome, sexo e ativo. A data não: trocá-la é `claim_player`. */
  async save(player: Player): Promise<Player> {
    const table = await this.table('players');
    const { data, error } = await table
      .update({ name: player.name, gender: player.gender, active: player.active })
      .eq('id', player.id)
      .select(COLUMNS)
      .single();
    return toPlayer(this.unwrap(data, error, 'Não foi possível salvar o jogador'));
  }

  async delete(id: string): Promise<void> {
    const table = await this.table('players');
    const { error } = await table.delete().eq('id', id);
    if (error) {
      throw new Error(`Não foi possível apagar o jogador: ${error.message}`);
    }
  }
}

const COLUMNS = 'id, group_id, name, gender, active, created_at, updated_at';

type PlayerColumns = Pick<
  Row<'players'>,
  'id' | 'group_id' | 'name' | 'gender' | 'active' | 'created_at' | 'updated_at'
>;

function toPlayer(row: PlayerColumns): Player {
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    gender: row.gender as Gender,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
