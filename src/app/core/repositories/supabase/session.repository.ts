import { Injectable } from '@angular/core';
import { Session } from '../../../shared/models';
import { SessionRepository } from '../repository.contracts';
import { SupabaseRepositoryBase } from './supabase-repository.base';

/**
 * As sessões: um dia de vôlei.
 *
 * O modelo de tela carrega as listas de presentes, de sorteios e de
 * campeonatos dentro da sessão; no banco elas são tabelas separadas. Então ler
 * uma sessão é compor — mas numa consulta só, com join, e não uma por jogador.
 *
 * Um dia tem UMA sessão por vôlei, e isso é um índice único no banco: duas
 * pessoas abrindo a presença ao mesmo tempo caem na mesma sessão em vez de
 * criar duas.
 */
@Injectable()
export class SupabaseSessionRepository extends SupabaseRepositoryBase implements SessionRepository {
  async getAll(): Promise<Session[]> {
    const table = await this.table('sessions');
    const { data, error } = await table.select(SELECT).order('date', { ascending: false });
    return this.unwrap(data, error, 'Não foi possível ler as sessões').map(toSession);
  }

  async getByGroupId(groupId: string): Promise<Session[]> {
    const table = await this.table('sessions');
    const { data, error } = await table
      .select(SELECT)
      .eq('group_id', groupId)
      .order('date', { ascending: false });
    return this.unwrap(data, error, 'Não foi possível ler as sessões').map(toSession);
  }

  async getById(id: string): Promise<Session | undefined> {
    const table = await this.table('sessions');
    const { data, error } = await table.select(SELECT).eq('id', id).maybeSingle();
    if (error) {
      throw new Error(`Não foi possível ler a sessão: ${error.message}`);
    }
    return data ? toSession(data) : undefined;
  }

  /**
   * Grava a sessão e acerta a presença.
   *
   * A presença é um conjunto, não uma lista ordenada: quem saiu da lista sai da
   * tabela, quem entrou entra. `drawIds` e `tournamentIds` não são gravados
   * daqui — eles são consequência de existir sorteio e campeonato apontando
   * para esta sessão.
   */
  async save(session: Session): Promise<Session> {
    const sessions = await this.table('sessions');
    const { error: upsertError } = await sessions.upsert({
      id: session.id,
      group_id: session.groupId,
      date: session.date,
    });
    if (upsertError) {
      throw new Error(`Não foi possível salvar a sessão: ${upsertError.message}`);
    }

    const presence = await this.table('session_players');
    const { data: current, error: readError } = await presence
      .select('player_id')
      .eq('session_id', session.id);
    if (readError) {
      throw new Error(`Não foi possível ler a presença: ${readError.message}`);
    }

    const before = new Set(current.map((row) => row.player_id));
    const after = new Set(session.playerIds);
    const removed = [...before].filter((id) => !after.has(id));
    const added = [...after].filter((id) => !before.has(id));

    if (removed.length > 0) {
      const { error } = await presence
        .delete()
        .eq('session_id', session.id)
        .in('player_id', removed);
      if (error) {
        throw new Error(`Não foi possível tirar alguém da presença: ${error.message}`);
      }
    }
    if (added.length > 0) {
      const { error } = await presence.insert(
        added.map((playerId) => ({
          group_id: session.groupId,
          session_id: session.id,
          player_id: playerId,
        })),
      );
      if (error) {
        throw new Error(`Não foi possível marcar presença: ${error.message}`);
      }
    }

    const saved = await this.getById(session.id);
    if (!saved) {
      throw new Error('A sessão desapareceu depois de salva');
    }
    return saved;
  }

  async delete(id: string): Promise<void> {
    const table = await this.table('sessions');
    const { error } = await table.delete().eq('id', id);
    if (error) {
      throw new Error(`Não foi possível apagar a sessão: ${error.message}`);
    }
  }
}

const SELECT = `
  id, group_id, date, created_at, updated_at,
  session_players (player_id),
  draws (id),
  tournaments (id)
`;

interface SessionJoin {
  id: string;
  group_id: string;
  date: string;
  created_at: string;
  updated_at: string;
  session_players: { player_id: string }[];
  draws: { id: string }[];
  tournaments: { id: string }[];
}

function toSession(row: SessionJoin): Session {
  return {
    id: row.id,
    groupId: row.group_id,
    date: row.date,
    playerIds: row.session_players.map((presence) => presence.player_id),
    drawIds: row.draws.map((draw) => draw.id),
    tournamentIds: row.tournaments.map((tournament) => tournament.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
