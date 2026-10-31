import { Injectable, inject, signal } from '@angular/core';
import { AppFacade } from '../facade/app.facade';
import { IdentityService, MyGroup } from '../identity';
import { TournamentService } from '../services/tournament.service';
import { phaseLabel } from '../rules/bracket-phases';
import { Group, GroupRole, Session, Tournament } from '../../shared/models';
import { todayDateString } from '../../shared/utils/date.util';

export interface GroupSummary {
  readonly group: Group;
  readonly role: GroupRole;
  /** Criou o vôlei, ou o recebeu. Vem do banco, não de comparação na tela. */
  readonly isOwner: boolean;
  readonly playerCount: number;
  readonly gamesPlayed: number;
  /** Posição no ranking do grupo por aproveitamento, 1-based. */
  readonly rankingPosition: number | null;
  /** Sessão de hoje com campeonato em andamento. */
  readonly liveSession: Session | null;
  readonly liveTournament: Tournament | null;
  /** Fase e adversário do próximo jogo do usuário, quando há. */
  readonly myNextMatch: { readonly phaseLabel: string; readonly opponent: string } | null;
  readonly nextSessionDate: string | null;
}

/**
 * Os vôleis de que a pessoa participa (a tela "Seus vôleis").
 *
 * O papel vale por grupo, então o resumo de cada um carrega o papel junto.
 */
@Injectable({ providedIn: 'root' })
export class GroupsStore {
  private readonly facade = inject(AppFacade);
  private readonly identity = inject(IdentityService);
  private readonly tournamentService = inject(TournamentService);

  readonly summaries = signal<readonly GroupSummary[]>([]);
  readonly loading = signal(false);

  /** Os vôleis de quem está usando o app, com o papel de cada um. */
  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const mine = await this.identity.myGroups();
      const summaries: GroupSummary[] = [];

      for (const membership of mine) {
        const summary = await this.buildSummary(membership);
        if (summary) {
          summaries.push(summary);
        }
      }

      this.summaries.set(summaries);
    } finally {
      this.loading.set(false);
    }
  }

  private async buildSummary(membership: MyGroup): Promise<GroupSummary | null> {
    const groupId = membership.groupId;
    // Visitante não tem jogador: abriu o link e ainda não disse quem é. Ele vê
    // o vôlei, e nenhum número é dele.
    const playerId = membership.playerId;

    const [group, sessions] = await Promise.all([
      this.facade.getGroupById(groupId),
      this.facade.getSessionsByGroupId(groupId),
    ]);

    if (!group) {
      return null;
    }

    const today = todayDateString();
    const todaySession = sessions.find((session) => session.date === today) ?? null;
    const tournaments = todaySession
      ? await this.facade.getTournamentsBySessionId(todaySession.id)
      : [];
    const liveTournament =
      tournaments.find((tournament) => tournament.status === 'in-progress') ?? null;

    const { gamesPlayed, rankingPosition } = playerId
      ? await this.playerStandingInGroup(sessions, groupId, playerId)
      : { gamesPlayed: 0, rankingPosition: null };

    return {
      group,
      role: membership.role,
      isOwner: membership.isOwner,
      playerCount: membership.playerCount,
      gamesPlayed,
      rankingPosition,
      liveSession: liveTournament ? todaySession : null,
      liveTournament,
      myNextMatch:
        liveTournament && playerId ? await this.myNextMatch(liveTournament, playerId) : null,
      nextSessionDate: todaySession ? null : (sessions[0]?.date ?? null),
    };
  }

  /** A fase e o adversário do próximo jogo do usuário no campeonato ao vivo. */
  private async myNextMatch(
    tournament: Tournament,
    playerId: string,
  ): Promise<{ phaseLabel: string; opponent: string } | null> {
    const next = await this.tournamentService.getNextMatches(tournament);
    const names = new Map(
      (await this.facade.getPlayers()).map((player) => [player.id, player.name]),
    );

    const label = (teamId: string) =>
      (tournament.teams.find((team) => team.id === teamId)?.playerIds ?? [])
        .map((id) => names.get(id) ?? '?')
        .join(' + ')
        .toUpperCase();

    for (const bracket of next) {
      const mine = [bracket.teamAId, bracket.teamBId].find((teamId) =>
        tournament.teams.find((team) => team.id === teamId)?.playerIds.includes(playerId),
      );
      if (!mine) {
        continue;
      }
      const opponentId = mine === bracket.teamAId ? bracket.teamBId : bracket.teamAId;
      return { phaseLabel: phaseLabel(bracket.phase), opponent: label(opponentId) };
    }

    return null;
  }

  /**
   * Jogos e posição no ranking do grupo, contando só as sessões dele — a mesma
   * pessoa tem números diferentes em cada vôlei.
   */
  private async playerStandingInGroup(
    sessions: readonly Session[],
    groupId: string,
    playerId: string,
  ): Promise<{ gamesPlayed: number; rankingPosition: number | null }> {
    const sessionIds = new Set(sessions.map((session) => session.id));
    const memberIds = (await this.facade.getPlayersByGroupId(groupId)).map((player) => player.id);
    const [allMatches, allTournaments] = await Promise.all([
      this.facade.getMatches(),
      this.facade.getTournaments(),
    ]);

    const teams = new Map<string, readonly string[]>();
    for (const tournament of allTournaments) {
      if (!sessionIds.has(tournament.sessionId)) {
        continue;
      }
      for (const team of tournament.teams) {
        teams.set(team.id, team.playerIds);
      }
    }

    const tally = new Map<string, { games: number; wins: number }>();
    for (const memberId of memberIds) {
      tally.set(memberId, { games: 0, wins: 0 });
    }

    for (const match of allMatches) {
      if (!match.winnerId || !sessionIds.has(match.sessionId)) {
        continue;
      }

      for (const teamId of [match.teamAId, match.teamBId]) {
        for (const member of teams.get(teamId) ?? []) {
          const entry = tally.get(member);
          if (!entry) {
            continue;
          }
          entry.games++;
          if (match.winnerId === teamId) {
            entry.wins++;
          }
        }
      }
    }

    const ranked = [...tally.entries()]
      .filter(([, entry]) => entry.games > 0)
      .sort(([, a], [, b]) => b.wins / b.games - a.wins / a.games);

    const index = ranked.findIndex(([id]) => id === playerId);

    return {
      gamesPlayed: tally.get(playerId)?.games ?? 0,
      rankingPosition: index >= 0 ? index + 1 : null,
    };
  }
}
