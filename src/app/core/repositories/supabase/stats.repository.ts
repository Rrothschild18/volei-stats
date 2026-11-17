import { Injectable } from '@angular/core';
import {
  PlayerSessionStats,
  PlayerStats,
  TeamSessionStats,
  TeamStats,
} from '../../../shared/models';
import { StatsRepository } from '../repository.contracts';
import { SupabaseRepositoryBase } from './supabase-repository.base';

/**
 * As estatísticas pelas views `player_stats` e `team_stats`.
 *
 * As views também consertam a contagem de esperas do §7.6: elas contam apenas
 * sorteios escolhidos, e não as três propostas.
 */
@Injectable()
export class SupabaseStatsRepository extends SupabaseRepositoryBase implements StatsRepository {
  async playerStats(groupId: string): Promise<readonly PlayerStats[]> {
    const client = await this.rpc();
    const { data, error } = await client
      .from('player_stats')
      .select('player_id, games_played, wins, losses, times_waited, win_percentage')
      .eq('group_id', groupId);

    if (error) {
      throw new Error(`Não foi possível ler as estatísticas: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      playerId: row.player_id ?? '',
      gamesPlayed: row.games_played ?? 0,
      wins: row.wins ?? 0,
      losses: row.losses ?? 0,
      timesWaited: row.times_waited ?? 0,
      winPercentage: row.win_percentage ?? 0,
    }));
  }

  /**
   * A view identifica a dupla pelo PAR de jogadores, não pelo id da dupla — a
   * mesma dupla sorteada em dias diferentes é a mesma dupla. Os nomes não estão
   * na view, então vêm da tabela de jogadores na mesma ida.
   */
  async teamStats(groupId: string): Promise<readonly TeamStats[]> {
    const client = await this.rpc();
    const [teams, players] = await Promise.all([
      client
        .from('team_stats')
        .select('player1_id, player2_id, games_played, wins, losses, win_percentage')
        .eq('group_id', groupId),
      client.from('players').select('id, name').eq('group_id', groupId),
    ]);

    if (teams.error) {
      throw new Error(`Não foi possível ler as estatísticas das duplas: ${teams.error.message}`);
    }
    if (players.error) {
      throw new Error(`Não foi possível ler os nomes: ${players.error.message}`);
    }

    const names = new Map((players.data ?? []).map((player) => [player.id, player.name]));

    return (teams.data ?? []).map((row) => {
      const ids: [string, string] = [row.player1_id ?? '', row.player2_id ?? ''];
      return {
        playerIds: ids,
        playerNames: [names.get(ids[0]) ?? '?', names.get(ids[1]) ?? '?'],
        gamesPlayed: row.games_played ?? 0,
        wins: row.wins ?? 0,
        losses: row.losses ?? 0,
        winPercentage: row.win_percentage ?? 0,
      };
    });
  }

  /**
   * A conta por noite, para a janela das últimas sessões (ticket 04).
   *
   * Vem do banco já agrupada por sessão: somar aqui as 4 noites escolhidas é
   * aritmética de dezenas de linhas, enquanto carregar as partidas para contar
   * no navegador era o que o §7.12 mandou parar de fazer.
   */
  async playerSessionStats(groupId: string): Promise<readonly PlayerSessionStats[]> {
    const client = await this.rpc();
    const { data, error } = await client
      .from('player_session_stats')
      .select('session_id, player_id, games_played, wins, losses, times_waited')
      .eq('group_id', groupId);

    if (error) {
      throw new Error(`Não foi possível ler as estatísticas por noite: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      sessionId: row.session_id ?? '',
      playerId: row.player_id ?? '',
      gamesPlayed: row.games_played ?? 0,
      wins: row.wins ?? 0,
      losses: row.losses ?? 0,
      timesWaited: row.times_waited ?? 0,
    }));
  }

  async teamSessionStats(groupId: string): Promise<readonly TeamSessionStats[]> {
    const client = await this.rpc();
    const { data, error } = await client
      .from('team_session_stats')
      .select('session_id, player1_id, player2_id, games_played, wins, losses')
      .eq('group_id', groupId);

    if (error) {
      throw new Error(`Não foi possível ler as duplas por noite: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      sessionId: row.session_id ?? '',
      playerIds: [row.player1_id ?? '', row.player2_id ?? ''] as [string, string],
      gamesPlayed: row.games_played ?? 0,
      wins: row.wins ?? 0,
      losses: row.losses ?? 0,
    }));
  }
}
