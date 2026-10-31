import { Injectable } from '@angular/core';
import {
  OddPlayerPlacement,
  TiebreakDecision,
  TiebreakKind,
  Tournament,
  TournamentPriorityEntry,
  TournamentPriorityReason,
  TournamentStanding,
  TournamentTeam,
} from '../../../shared/models';
import { TournamentRepository } from '../repository.contracts';
import { SupabaseRepositoryBase } from './supabase-repository.base';

/**
 * O campeonato, que é o maior agregado do app.
 *
 * Na tela ele é um documento: duplas, classificação, prioridades, encaixe do
 * avulso e desempates, tudo dentro de um objeto. No banco são seis tabelas. O
 * limite do agregado é o campeonato, então ler e gravar é sempre o conjunto
 * inteiro — nunca metade dele.
 *
 * As partidas são a exceção: elas têm vida própria (`matches` na tela é só a
 * lista de ids) porque é nelas que duas pessoas escrevem ao mesmo tempo, e cada
 * placar precisa poder falhar sozinho, com a trava do primeiro lançamento.
 */
@Injectable()
export class SupabaseTournamentRepository
  extends SupabaseRepositoryBase
  implements TournamentRepository
{
  async getAll(): Promise<Tournament[]> {
    const table = await this.table('tournaments');
    const { data, error } = await table.select(SELECT).order('created_at');
    return this.unwrap(data, error, 'Não foi possível ler os campeonatos').map(toTournament);
  }

  async getBySessionId(sessionId: string): Promise<Tournament[]> {
    const table = await this.table('tournaments');
    const { data, error } = await table
      .select(SELECT)
      .eq('session_id', sessionId)
      .order('created_at');
    return this.unwrap(data, error, 'Não foi possível ler os campeonatos').map(toTournament);
  }

  async getById(id: string): Promise<Tournament | undefined> {
    const table = await this.table('tournaments');
    const { data, error } = await table.select(SELECT).eq('id', id).maybeSingle();
    if (error) {
      throw new Error(`Não foi possível ler o campeonato: ${error.message}`);
    }
    return data ? toTournament(data) : undefined;
  }

  async save(tournament: Tournament): Promise<Tournament> {
    const groupId = await this.groupIdOfSession(tournament.sessionId);

    const tournaments = await this.table('tournaments');
    const { error } = await tournaments.upsert({
      id: tournament.id,
      group_id: groupId,
      session_id: tournament.sessionId,
      draw_id: tournament.drawId,
      name: tournament.name,
      format_id: tournament.formatId,
      point_limit: tournament.pointLimit,
      third_place_enabled: tournament.thirdPlaceEnabled,
      odd_player_placement_enabled: tournament.oddPlayerPlacementEnabled,
      odd_player_loser_priority_enabled: tournament.oddPlayerLoserPriorityEnabled,
      waiting_player_id: tournament.waitingPlayerId,
      status: tournament.status,
    });
    if (error) {
      throw new Error(`Não foi possível salvar o campeonato: ${error.message}`);
    }

    await this.saveTeams(tournament, groupId);
    await this.saveStandings(tournament, groupId);
    await this.savePriorityEntries(tournament, groupId);
    await this.savePlacement(tournament, groupId);
    await this.saveTiebreaks(tournament, groupId);

    const saved = await this.getById(tournament.id);
    if (!saved) {
      throw new Error('O campeonato desapareceu depois de salvo');
    }
    return saved;
  }

  async delete(id: string): Promise<void> {
    const table = await this.table('tournaments');
    const { error } = await table.delete().eq('id', id);
    if (error) {
      throw new Error(`Não foi possível apagar o campeonato: ${error.message}`);
    }
  }

  /**
   * As duplas mudam de estado durante o campeonato (eliminada, encaixe), mas
   * nunca mudam de identidade — então é upsert, e não troca do conjunto: apagar
   * e reinserir derrubaria as partidas, que apontam para elas.
   */
  private async saveTeams(tournament: Tournament, groupId: string): Promise<void> {
    if (tournament.teams.length === 0) {
      return;
    }
    const teams = await this.table('tournament_teams');
    const { error } = await teams.upsert(
      tournament.teams.map((team, index) => ({
        id: team.id,
        group_id: groupId,
        tournament_id: tournament.id,
        position: index + 1,
        player1_id: team.playerIds[0],
        player2_id: team.playerIds[1],
        eliminated: team.eliminated,
        eliminated_directly: team.eliminatedDirectly,
        synthetic: team.synthetic,
        original_player1_id: team.originalPlayerIds?.[0] ?? null,
        original_player2_id: team.originalPlayerIds?.[1] ?? null,
      })),
    );
    if (error) {
      throw new Error(`Não foi possível salvar as duplas: ${error.message}`);
    }
  }

  private async saveStandings(tournament: Tournament, groupId: string): Promise<void> {
    const standings = await this.table('tournament_standings');
    const { error: clearError } = await standings.delete().eq('tournament_id', tournament.id);
    if (clearError) {
      throw new Error(`Não foi possível limpar a classificação: ${clearError.message}`);
    }
    if (tournament.finalStandings.length === 0) {
      return;
    }
    const { error } = await standings.insert(
      tournament.finalStandings.map((standing) => ({
        group_id: groupId,
        tournament_id: tournament.id,
        team_id: standing.teamId,
        position: standing.position,
      })),
    );
    if (error) {
      throw new Error(`Não foi possível salvar a classificação: ${error.message}`);
    }
  }

  private async savePriorityEntries(tournament: Tournament, groupId: string): Promise<void> {
    const entries = await this.table('tournament_priority_entries');
    const { error: clearError } = await entries.delete().eq('tournament_id', tournament.id);
    if (clearError) {
      throw new Error(`Não foi possível limpar as prioridades: ${clearError.message}`);
    }
    if (tournament.priorityEntries.length === 0) {
      return;
    }
    const { error } = await entries.insert(
      tournament.priorityEntries.map((entry) => ({
        group_id: groupId,
        tournament_id: tournament.id,
        player_id: entry.playerId,
        reason: entry.reason,
      })),
    );
    if (error) {
      throw new Error(`Não foi possível salvar as prioridades: ${error.message}`);
    }
  }

  private async savePlacement(tournament: Tournament, groupId: string): Promise<void> {
    const placements = await this.table('odd_player_placements');
    if (!tournament.oddPlayerPlacement) {
      const { error } = await placements.delete().eq('tournament_id', tournament.id);
      if (error) {
        throw new Error(`Não foi possível limpar o encaixe: ${error.message}`);
      }
      return;
    }

    const placement = tournament.oddPlayerPlacement;
    const { error } = await placements.upsert({
      tournament_id: tournament.id,
      group_id: groupId,
      source_team_id: placement.sourceTeamId,
      encaixe_team_id: placement.encaixeTeamId,
      surviving_player_id: placement.survivingPlayerId,
      eliminated_player_id: placement.eliminatedPlayerId,
      decided_by: placement.decidedBy,
    });
    if (error) {
      throw new Error(`Não foi possível salvar o encaixe: ${error.message}`);
    }
  }

  private async saveTiebreaks(tournament: Tournament, groupId: string): Promise<void> {
    if (tournament.tiebreakDecisions.length === 0) {
      return;
    }
    const decisions = await this.table('tiebreak_decisions');
    const { error } = await decisions.upsert(
      tournament.tiebreakDecisions.map((decision) => ({
        tournament_id: tournament.id,
        group_id: groupId,
        kind: decision.kind,
        team_ids: decision.teamIds,
        winner_team_id: decision.winnerTeamId,
        decided_by: decision.decidedBy,
      })),
    );
    if (error) {
      throw new Error(`Não foi possível salvar o desempate: ${error.message}`);
    }
  }

  private async groupIdOfSession(sessionId: string): Promise<string> {
    const sessions = await this.table('sessions');
    const { data, error } = await sessions.select('group_id').eq('id', sessionId).single();
    return this.unwrap(data, error, 'Não foi possível achar a sessão do campeonato').group_id;
  }
}

const SELECT = `
  id, session_id, draw_id, name, format_id, point_limit, third_place_enabled,
  odd_player_placement_enabled, odd_player_loser_priority_enabled,
  waiting_player_id, status, created_at, updated_at,
  tournament_teams (
    id, position, player1_id, player2_id, eliminated, eliminated_directly,
    synthetic, original_player1_id, original_player2_id
  ),
  tournament_standings (team_id, position),
  tournament_priority_entries (player_id, reason),
  odd_player_placements (
    source_team_id, encaixe_team_id, surviving_player_id, eliminated_player_id,
    decided_by, decided_at
  ),
  tiebreak_decisions (kind, team_ids, winner_team_id, decided_by, decided_at),
  matches (id)
`;

interface TournamentJoin {
  id: string;
  session_id: string;
  draw_id: string;
  name: string;
  format_id: string;
  point_limit: number;
  third_place_enabled: boolean;
  odd_player_placement_enabled: boolean;
  odd_player_loser_priority_enabled: boolean;
  waiting_player_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  tournament_teams: {
    id: string;
    position: number;
    player1_id: string;
    player2_id: string;
    eliminated: boolean;
    eliminated_directly: boolean;
    synthetic: boolean;
    original_player1_id: string | null;
    original_player2_id: string | null;
  }[];
  tournament_standings: { team_id: string; position: number }[];
  tournament_priority_entries: { player_id: string; reason: string }[];
  odd_player_placements: {
    source_team_id: string;
    encaixe_team_id: string;
    surviving_player_id: string;
    eliminated_player_id: string;
    decided_by: string | null;
    decided_at: string;
  }[];
  tiebreak_decisions: {
    kind: string;
    team_ids: string[];
    winner_team_id: string;
    decided_by: string | null;
    decided_at: string;
  }[];
  matches: { id: string }[];
}

function toTournament(row: TournamentJoin): Tournament {
  const teams: TournamentTeam[] = [...row.tournament_teams]
    .sort((a, b) => a.position - b.position)
    .map((team) => ({
      id: team.id,
      playerIds: [team.player1_id, team.player2_id],
      eliminated: team.eliminated,
      eliminatedDirectly: team.eliminated_directly,
      synthetic: team.synthetic,
      originalPlayerIds:
        team.original_player1_id && team.original_player2_id
          ? [team.original_player1_id, team.original_player2_id]
          : null,
    }));

  const finalStandings: TournamentStanding[] = [...row.tournament_standings]
    .sort((a, b) => a.position - b.position)
    .map((standing) => ({ teamId: standing.team_id, position: standing.position }));

  const priorityEntries: TournamentPriorityEntry[] = row.tournament_priority_entries.map(
    (entry) => ({
      playerId: entry.player_id,
      reason: entry.reason as TournamentPriorityReason,
    }),
  );

  const placementRow = row.odd_player_placements[0];
  const oddPlayerPlacement: OddPlayerPlacement | null = placementRow
    ? {
        sourceTeamId: placementRow.source_team_id,
        encaixeTeamId: placementRow.encaixe_team_id,
        survivingPlayerId: placementRow.surviving_player_id,
        eliminatedPlayerId: placementRow.eliminated_player_id,
        decidedBy: placementRow.decided_by,
        decidedAt: placementRow.decided_at,
      }
    : null;

  const tiebreakDecisions: TiebreakDecision[] = row.tiebreak_decisions.map((decision) => ({
    kind: decision.kind as TiebreakKind,
    teamIds: decision.team_ids,
    winnerTeamId: decision.winner_team_id,
    decidedBy: decision.decided_by,
    decidedAt: decision.decided_at,
  }));

  return {
    id: row.id,
    name: row.name,
    sessionId: row.session_id,
    drawId: row.draw_id,
    formatId: row.format_id,
    teams,
    waitingPlayerId: row.waiting_player_id,
    oddPlayerPlacementEnabled: row.odd_player_placement_enabled,
    oddPlayerLoserPriorityEnabled: row.odd_player_loser_priority_enabled,
    oddPlayerPlacement,
    priorityEntries,
    pointLimit: row.point_limit,
    thirdPlaceEnabled: row.third_place_enabled,
    matches: row.matches.map((match) => match.id),
    status: row.status === 'completed' ? 'completed' : 'in-progress',
    finalStandings,
    tiebreakDecisions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
