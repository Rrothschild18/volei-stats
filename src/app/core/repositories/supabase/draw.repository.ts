import { Injectable } from '@angular/core';
import { DrawBadge, DrawProposal, Team } from '../../../shared/models';
import { DrawRepository } from '../repository.contracts';
import { Json } from '../../supabase/database.types';
import { SupabaseRepositoryBase } from './supabase-repository.base';

/**
 * As propostas de sorteio de uma sessão: as três que o gerador ofereceu, e qual
 * delas o grupo escolheu.
 *
 * O `group_id` não está no modelo de tela — o sorteio se identifica pela sessão.
 * Como as tabelas o exigem (é ele que deixa as políticas simples), ele é lido da
 * sessão na hora de gravar.
 */
@Injectable()
export class SupabaseDrawRepository extends SupabaseRepositoryBase implements DrawRepository {
  async getAll(): Promise<DrawProposal[]> {
    const table = await this.table('draws');
    const { data, error } = await table.select(SELECT);
    return this.unwrap(data, error, 'Não foi possível ler os sorteios').map(toDraw);
  }

  async getBySessionId(sessionId: string): Promise<DrawProposal[]> {
    const table = await this.table('draws');
    const { data, error } = await table
      .select(SELECT)
      .eq('session_id', sessionId)
      .order('score', { ascending: false });
    return this.unwrap(data, error, 'Não foi possível ler os sorteios').map(toDraw);
  }

  async getById(id: string): Promise<DrawProposal | undefined> {
    const table = await this.table('draws');
    const { data, error } = await table.select(SELECT).eq('id', id).maybeSingle();
    if (error) {
      throw new Error(`Não foi possível ler o sorteio: ${error.message}`);
    }
    return data ? toDraw(data) : undefined;
  }

  async save(draw: DrawProposal): Promise<DrawProposal> {
    const groupId = await this.groupIdOfSession(draw.sessionId);

    const draws = await this.table('draws');
    const { error: upsertError } = await draws.upsert({
      id: draw.id,
      group_id: groupId,
      session_id: draw.sessionId,
      waiting_player_id: draw.waitingPlayerId,
      score: draw.score,
      selected: draw.selected,
      // `badges` é jsonb: o tipo gerado pede `Json`, e um DrawBadge é isso.
      badges: draw.badges as unknown as NonNullable<Json>,
    });
    if (upsertError) {
      throw new Error(`Não foi possível salvar o sorteio: ${upsertError.message}`);
    }

    // As duplas de uma proposta não mudam depois de gerada: ela é refeita, não
    // editada. Então trocar o conjunto inteiro é mais simples e mais correto
    // que tentar casar dupla por dupla.
    const teams = await this.table('draw_teams');
    const { error: clearError } = await teams.delete().eq('draw_id', draw.id);
    if (clearError) {
      throw new Error(`Não foi possível limpar as duplas: ${clearError.message}`);
    }
    if (draw.teams.length > 0) {
      const { error } = await teams.insert(
        draw.teams.map((team, index) => ({
          id: team.id,
          group_id: groupId,
          draw_id: draw.id,
          position: index + 1,
          player1_id: team.playerIds[0],
          player2_id: team.playerIds[1],
        })),
      );
      if (error) {
        throw new Error(`Não foi possível salvar as duplas: ${error.message}`);
      }
    }

    const saved = await this.getById(draw.id);
    if (!saved) {
      throw new Error('O sorteio desapareceu depois de salvo');
    }
    return saved;
  }

  async delete(id: string): Promise<void> {
    const table = await this.table('draws');
    const { error } = await table.delete().eq('id', id);
    if (error) {
      throw new Error(`Não foi possível apagar o sorteio: ${error.message}`);
    }
  }

  private async groupIdOfSession(sessionId: string): Promise<string> {
    const sessions = await this.table('sessions');
    const { data, error } = await sessions.select('group_id').eq('id', sessionId).single();
    return this.unwrap(data, error, 'Não foi possível achar a sessão do sorteio').group_id;
  }
}

const SELECT = `
  id, session_id, waiting_player_id, score, selected, badges, created_at,
  draw_teams (id, position, player1_id, player2_id)
`;

interface DrawJoin {
  id: string;
  session_id: string;
  waiting_player_id: string | null;
  score: number;
  selected: boolean;
  badges: unknown;
  created_at: string;
  draw_teams: { id: string; position: number; player1_id: string; player2_id: string }[];
}

function toDraw(row: DrawJoin): DrawProposal {
  const teams: Team[] = [...row.draw_teams]
    .sort((a, b) => a.position - b.position)
    .map((team) => ({ id: team.id, playerIds: [team.player1_id, team.player2_id] }));

  return {
    id: row.id,
    sessionId: row.session_id,
    teams,
    waitingPlayerId: row.waiting_player_id,
    score: row.score,
    badges: Array.isArray(row.badges) ? (row.badges as DrawBadge[]) : [],
    selected: row.selected,
    createdAt: row.created_at,
  };
}
