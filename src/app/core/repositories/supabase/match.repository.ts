import { Injectable } from '@angular/core';
import { Match, MatchPhase } from '../../../shared/models';
import { MatchRepository } from '../repository.contracts';
import { SupabaseRepositoryBase } from './supabase-repository.base';

/**
 * As partidas.
 *
 * Três coisas aqui são do banco, não do app, e é de propósito:
 *   * vencedor, perdedor e diferença são colunas GERADAS — não há como
 *     divergirem do placar;
 *   * quem lançou e quem corrigiu são gravados por gatilho a partir de quem
 *     está pedindo. Como coluna comum, qualquer jogador mudava o placar
 *     deixando a assinatura em branco — e é essa assinatura que justifica
 *     deixar todo mundo corrigir;
 *   * empate e 0 × 0 são recusados por constraint.
 */
@Injectable()
export class SupabaseMatchRepository extends SupabaseRepositoryBase implements MatchRepository {
  async getAll(): Promise<Match[]> {
    const table = await this.table('matches');
    const { data, error } = await table.select(COLUMNS).order('played_at', { ascending: false });
    return this.unwrap(data, error, 'Não foi possível ler as partidas').map(toMatch);
  }

  async getByTournamentId(tournamentId: string): Promise<Match[]> {
    const table = await this.table('matches');
    const { data, error } = await table.select(COLUMNS).eq('tournament_id', tournamentId);
    return this.unwrap(data, error, 'Não foi possível ler as partidas').map(toMatch);
  }

  async getBySessionId(sessionId: string): Promise<Match[]> {
    const table = await this.table('matches');
    const { data, error } = await table.select(COLUMNS).eq('session_id', sessionId);
    return this.unwrap(data, error, 'Não foi possível ler as partidas').map(toMatch);
  }

  async getById(id: string): Promise<Match | undefined> {
    const table = await this.table('matches');
    const { data, error } = await table.select(COLUMNS).eq('id', id).maybeSingle();
    if (error) {
      throw new Error(`Não foi possível ler a partida: ${error.message}`);
    }
    return data ? toMatch(data) : undefined;
  }

  async save(match: Match): Promise<Match> {
    const groupId = await this.groupIdOfTournament(match.tournamentId);
    const table = await this.table('matches');
    const { data, error } = await table
      .upsert({
        id: match.id,
        group_id: groupId,
        tournament_id: match.tournamentId,
        session_id: match.sessionId,
        phase: match.phase,
        team_a_id: match.teamAId,
        team_b_id: match.teamBId,
        score_a: match.scoreA,
        score_b: match.scoreB,
        played_at: match.playedAt,
      })
      .select(COLUMNS)
      .single();
    return toMatch(this.unwrap(data, error, 'Não foi possível salvar o placar'));
  }

  async delete(id: string): Promise<void> {
    const table = await this.table('matches');
    const { error } = await table.delete().eq('id', id);
    if (error) {
      throw new Error(`Não foi possível apagar a partida: ${error.message}`);
    }
  }

  private async groupIdOfTournament(tournamentId: string): Promise<string> {
    const tournaments = await this.table('tournaments');
    const { data, error } = await tournaments.select('group_id').eq('id', tournamentId).single();
    return this.unwrap(data, error, 'Não foi possível achar o campeonato da partida').group_id;
  }
}

// Literal de uma peça só: o cliente do Supabase deriva o tipo da resposta do
// texto do select, e uma concatenação apagaria essa inferência.
const COLUMNS =
  'id, tournament_id, session_id, phase, team_a_id, team_b_id, score_a, score_b, winner_id, loser_id, point_difference, reported_by, corrected_by, corrected_at, played_at, created_at';

/** As colunas que o select acima pede — `group_id` não está entre elas. */
interface MatchColumns {
  id: string;
  tournament_id: string;
  session_id: string;
  phase: string;
  team_a_id: string;
  team_b_id: string;
  score_a: number;
  score_b: number;
  winner_id: string | null;
  loser_id: string | null;
  point_difference: number | null;
  reported_by: string | null;
  corrected_by: string | null;
  corrected_at: string | null;
  played_at: string;
  created_at: string;
}

function toMatch(row: MatchColumns): Match {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    sessionId: row.session_id,
    phase: row.phase as MatchPhase,
    teamAId: row.team_a_id,
    teamBId: row.team_b_id,
    scoreA: row.score_a,
    scoreB: row.score_b,
    winnerId: row.winner_id,
    loserId: row.loser_id,
    pointDifference: row.point_difference ?? Math.abs(row.score_a - row.score_b),
    reportedBy: row.reported_by,
    correctedBy: row.corrected_by,
    correctedAt: row.corrected_at,
    playedAt: row.played_at,
    createdAt: row.created_at,
  };
}
