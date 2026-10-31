import { Injectable, computed, inject, signal } from '@angular/core';
import { AppFacade } from '../facade/app.facade';
import { DrawService } from '../services/draw.service';
import { Match, Player, Session, Tournament } from '../../shared/models';

export interface WaitEntry {
  readonly player: Player;
  /** "esperou no camp. 1", "entrou no encaixe · camp. 2". */
  readonly reason: string;
}

/**
 * A sessão de hoje do grupo: quem apareceu, quais campeonatos já rolaram e
 * quem já esperou. O revezamento de espera (REGRAS.md §9.1) se apoia nesta
 * contagem, que vale só para o dia.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly facade = inject(AppFacade);
  private readonly draws = inject(DrawService);

  readonly session = signal<Session | null>(null);
  readonly players = signal<readonly Player[]>([]);
  readonly tournaments = signal<readonly Tournament[]>([]);
  readonly matches = signal<readonly Match[]>([]);
  readonly waitCounts = signal<ReadonlyMap<string, number>>(new Map());
  readonly loading = signal(false);

  readonly playersById = computed(
    () => new Map(this.players().map((player) => [player.id, player])),
  );

  readonly present = computed(() => {
    const byId = this.playersById();
    return (this.session()?.playerIds ?? [])
      .map((playerId) => byId.get(playerId))
      .filter((player): player is Player => !!player);
  });

  readonly activePlayers = computed(() => this.players().filter((player) => player.active));

  readonly liveTournament = computed(
    () => this.tournaments().find((tournament) => tournament.status === 'in-progress') ?? null,
  );

  readonly completedTournaments = computed(() =>
    this.tournaments()
      .filter((tournament) => tournament.status === 'completed')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );

  /** Quem já esperou hoje, com o motivo em texto. */
  readonly waitEntries = computed<WaitEntry[]>(() => {
    const byId = this.playersById();
    const entries: WaitEntry[] = [];

    this.tournaments()
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .forEach((tournament, index) => {
        const player = tournament.waitingPlayerId
          ? byId.get(tournament.waitingPlayerId)
          : undefined;
        if (!player) {
          return;
        }

        const joined = tournament.oddPlayerPlacement !== null;
        entries.push({
          player,
          reason: joined
            ? `entrou no encaixe · camp. ${index + 1}`
            : `esperou no camp. ${index + 1}`,
        });
      });

    return entries;
  });

  /** Quantos dos presentes ainda não esperaram hoje. */
  readonly yetToWait = computed(() => {
    const counts = this.waitCounts();
    return this.present().filter((player) => (counts.get(player.id) ?? 0) === 0).length;
  });

  async load(groupId: string): Promise<void> {
    this.loading.set(true);
    try {
      const [players, session] = await Promise.all([
        this.facade.getPlayersByGroupId(groupId),
        this.facade.getTodaySession(groupId),
      ]);

      this.players.set(players);
      this.session.set(session ?? null);

      if (!session) {
        this.tournaments.set([]);
        this.matches.set([]);
        this.waitCounts.set(new Map());
        return;
      }

      const [tournaments, matches, waitCounts] = await Promise.all([
        this.facade.getTournamentsBySessionId(session.id),
        this.facade.getMatchesBySessionId(session.id),
        this.draws.getWaitCountsInSession(session.id),
      ]);

      this.tournaments.set(tournaments);
      this.matches.set(matches);
      this.waitCounts.set(waitCounts);
    } finally {
      this.loading.set(false);
    }
  }

  /** Relê a sessão corrente depois de uma escrita. */
  async reload(): Promise<void> {
    const groupId = this.session()?.groupId;
    if (groupId) {
      await this.load(groupId);
    }
  }
}
