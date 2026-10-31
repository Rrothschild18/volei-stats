import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppFacade } from '../../../core/facade/app.facade';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import { LiveTournamentStore } from '../../../core/stores/live-tournament.store';
import { TournamentService } from '../../../core/services/tournament.service';
import { TournamentPriorityEntry } from '../../../shared/models';
import {
  ActionBarComponent,
  BlueprintComponent,
  HeroFieldComponent,
  IconComponent,
  InnerHeaderComponent,
  SectionBandComponent,
} from '../../../shared/ui';

interface StandingRow {
  readonly position: number;
  readonly teamId: string;
  readonly label: string;
  readonly record: string;
  readonly balance: string;
  readonly tag: string | null;
  readonly isMine: boolean;
}

/**
 * Classificação final (1t) e o resultado do jogador (1u).
 *
 * A dupla desfeita no encaixe não ocupa posição na tabela — ela deixou de
 * existir no meio do campeonato e aparece como nota de rodapé (REGRAS.md §4.6).
 */
@Component({
  selector: 'app-standings',
  imports: [
    ActionBarComponent,
    BlueprintComponent,
    HeroFieldComponent,
    IconComponent,
    InnerHeaderComponent,
    SectionBandComponent,
  ],
  template: `
    <app-inner-header
      context="CAMPEONATO · FINALIZADO"
      [title]="store.tournament()?.name ?? ''"
      (back)="back()"
    >
      @if (group.isOwner()) {
        <button
          type="button"
          class="btn btn-ghost btn-icon border-0"
          aria-label="Mais ações"
          [attr.aria-expanded]="menuOpen()"
          (click)="menuOpen.set(!menuOpen())"
        >
          <app-icon name="ellipsis-vertical" [size]="22" />
        </button>
      }
    </app-inner-header>

    <div class="flex flex-col gap-5 px-4 pb-6">
      @if (myPosition() === null) {
        @if (champions(); as team) {
          <app-blueprint class="flex flex-col gap-1 p-4">
            <app-icon name="crown" [size]="34" class="text-accent-700" />
            <p class="kicker">{{ championsKicker() }}</p>
            <p class="font-heading text-[36px] leading-none font-semibold uppercase">
              {{ team.label }}
            </p>
          </app-blueprint>
        }
      } @else {
        <app-hero-field kicker="SEU RESULTADO">
          <p class="flex items-baseline gap-3">
            <span class="font-heading text-[56px] leading-none font-semibold">{{
              myPosition() ?? '—'
            }}</span>
            <span class="font-heading text-[18px] font-semibold uppercase">{{ myNote() }}</span>
          </p>
        </app-hero-field>
      }

      <section>
        <table class="w-full border-collapse">
          <caption class="sr-only">
            Classificação final do campeonato
          </caption>
          <thead>
            <tr class="bg-accent-100 text-[11px] tracking-[0.06em] uppercase">
              <th class="w-7 py-2 pl-1 text-left font-semibold">Nº</th>
              <th class="py-2 text-left font-semibold">Dupla</th>
              <th class="w-11 py-2 text-right font-semibold">V–D</th>
              <th class="w-10 py-2 pr-1 text-right font-semibold">Saldo</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.teamId) {
              <tr class="row-rule h-11" [class.bg-accent-100]="row.isMine">
                <td class="pl-1 text-[13px] tnum muted">{{ row.position }}</td>
                <td>
                  <span class="flex items-center gap-2">
                    <span class="font-heading text-[17px] font-semibold uppercase">{{
                      row.label
                    }}</span>
                    @if (row.tag) {
                      <span class="tag tag-neutral">{{ row.tag }}</span>
                    }
                  </span>
                </td>
                <td class="text-right text-[14px] tnum">{{ row.record }}</td>
                <td class="pr-1 text-right text-[14px] tnum">{{ row.balance }}</td>
              </tr>
            }
          </tbody>
        </table>

        @if (dissolvedNote(); as note) {
          <p class="mt-2 text-[12px] muted">{{ note }}</p>
        }
      </section>

      @if (priorities().length > 0) {
        <section>
          <app-section-band label="PRIORIDADE NO PRÓXIMO SORTEIO" />
          @for (entry of priorities(); track entry.playerId) {
            <div class="row-rule flex h-10 items-center gap-3">
              <span class="font-heading text-[17px] font-semibold uppercase">{{
                nameOf(entry.playerId)
              }}</span>
              <span class="flex-1 text-right text-[13px] muted">{{ reasonLabel(entry) }}</span>
            </div>
          }
        </section>
      }

      @if (group.isOwner() && menuOpen()) {
        <button
          type="button"
          class="flex items-center gap-2 self-start text-[13px] text-accent-700"
          (click)="confirmingDelete.set(true)"
        >
          <app-icon name="trash-2" [size]="16" />
          Excluir campeonato (some das prioridades e estatísticas)
        </button>
      }
    </div>

    @if (group.canPlay()) {
      <app-action-bar [pair]="true" [withTabBar]="true">
        <button type="button" class="btn btn-secondary h-13" (click)="share()">NO ZAP</button>
        <button
          type="button"
          class="btn btn-primary blueprint h-13 text-[17px]"
          (click)="newDraw()"
        >
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i>
          <i class="corner br"></i>
          <app-icon name="dices" [size]="20" />
          NOVO SORTEIO
        </button>
      </app-action-bar>
    } @else {
      <app-action-bar [withTabBar]="true">
        <button type="button" class="btn btn-secondary h-13" (click)="share()">
          <app-icon name="send" [size]="18" />
          COMPARTILHAR NO WHATSAPP
        </button>
      </app-action-bar>
    }

    @if (confirmingDelete()) {
      <div class="dialog-backdrop items-center">
        <app-blueprint
          class="dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Excluir campeonato"
        >
          <h3 class="font-heading text-[20px] font-semibold uppercase">Excluir campeonato?</h3>
          <p class="text-[14px]">
            Ele sai das prioridades do próximo sorteio e das estatísticas de todo mundo. Não tem
            como desfazer.
          </p>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="btn btn-secondary" (click)="confirmingDelete.set(false)">
              CANCELAR
            </button>
            <button type="button" class="btn btn-primary" (click)="remove()">EXCLUIR</button>
          </div>
        </app-blueprint>
      </div>
    }
  `,
  host: { class: 'block' },
})
export class StandingsComponent implements OnInit {
  private readonly facade = inject(AppFacade);
  private readonly tournaments = inject(TournamentService);
  private readonly router = inject(Router);
  protected readonly group = inject(CurrentGroupStore);
  protected readonly store = inject(LiveTournamentStore);

  readonly tournamentId = input.required<string>();

  protected readonly menuOpen = signal(false);
  protected readonly confirmingDelete = signal(false);

  private readonly stats = computed(() => {
    const tournament = this.store.tournament();
    if (!tournament) {
      return new Map<string, { wins: number; losses: number; diff: number }>();
    }

    const tally = new Map<string, { wins: number; losses: number; diff: number }>();
    for (const team of tournament.teams) {
      tally.set(team.id, { wins: 0, losses: 0, diff: 0 });
    }

    for (const match of this.store.completedMatches()) {
      const a = tally.get(match.teamAId);
      const b = tally.get(match.teamBId);
      if (a) {
        a.diff += match.scoreA - match.scoreB;
        if (match.winnerId === match.teamAId) {
          a.wins++;
        } else {
          a.losses++;
        }
      }
      if (b) {
        b.diff += match.scoreB - match.scoreA;
        if (match.winnerId === match.teamBId) {
          b.wins++;
        } else {
          b.losses++;
        }
      }
    }

    return tally;
  });

  protected readonly rows = computed<StandingRow[]>(() => {
    const tournament = this.store.tournament();
    if (!tournament) {
      return [];
    }

    const standings =
      tournament.finalStandings.length > 0
        ? tournament.finalStandings
        : this.tournaments.computeFinalStandings(tournament, [...this.store.completedMatches()]);

    const tally = this.stats();
    const placement = tournament.oddPlayerPlacement;
    const playerId = this.group.playerId();

    return standings
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((standing) => {
        const entry = tally.get(standing.teamId) ?? { wins: 0, losses: 0, diff: 0 };
        const team = tournament.teams.find((candidate) => candidate.id === standing.teamId);

        return {
          position: standing.position,
          teamId: standing.teamId,
          label: this.store.teamLabel(standing.teamId),
          record: `${entry.wins}–${entry.losses}`,
          balance: entry.diff > 0 ? `+${entry.diff}` : `${entry.diff}`,
          tag:
            standing.teamId === placement?.encaixeTeamId
              ? 'encaixe'
              : team?.eliminatedDirectly
                ? 'eliminação direta'
                : null,
          isMine: !!team?.playerIds.includes(playerId),
        };
      });
  });

  protected readonly champions = computed(() => this.rows()[0] ?? null);

  protected readonly championsKicker = computed(() => {
    const champion = this.champions();
    if (!champion) {
      return '';
    }
    const wins = champion.record.split('–')[0];
    return `CAMPEÕES · ${wins} ${wins === '1' ? 'VITÓRIA' : 'VITÓRIAS'} · SALDO ${champion.balance}`;
  });

  protected readonly myRow = computed(() => this.rows().find((row) => row.isMine) ?? null);

  protected readonly myPosition = computed(() => {
    const row = this.myRow();
    return row ? `${row.position}º` : null;
  });

  protected readonly myNote = computed(() => {
    const row = this.myRow();
    const tournament = this.store.tournament();
    if (!row || !tournament) {
      return '';
    }

    const team = tournament.teams.find((candidate) => candidate.id === row.teamId);
    const partnerId = team?.playerIds.find((playerId) => playerId !== this.group.playerId());
    const partner = this.store.playerName(partnerId ?? null);
    const viaEncaixe = row.teamId === tournament.oddPlayerPlacement?.encaixeTeamId;

    return `COM ${partner?.toUpperCase() ?? '?'}${viaEncaixe ? ', PELO ENCAIXE' : ''} · ${row.record}`;
  });

  /** A dupla original desfeita no encaixe: fora da tabela, dita no rodapé. */
  protected readonly dissolvedNote = computed(() => {
    const tournament = this.store.tournament();
    const placement = tournament?.oddPlayerPlacement;
    if (!placement) {
      return null;
    }

    const original = this.store.teamLabel(placement.sourceTeamId);
    const surviving = this.store.playerName(placement.survivingPlayerId);
    const eliminated = this.store.playerName(placement.eliminatedPlayerId);
    const waiting = this.store.playerName(tournament?.waitingPlayerId ?? null);

    return `${original} — dupla original, desfeita no encaixe: ${surviving} venceu o par-ou-ímpar e jogou com ${waiting}; ${eliminated} saiu.`;
  });

  protected readonly priorities = computed(() => this.store.tournament()?.priorityEntries ?? []);

  async ngOnInit(): Promise<void> {
    await this.store.load(this.tournamentId());
  }

  protected nameOf(playerId: string): string {
    return this.store.playerName(playerId) ?? '?';
  }

  protected reasonLabel(entry: TournamentPriorityEntry): string {
    switch (entry.reason) {
      case 'direct-elimination':
        return 'Eliminação direta';
      case 'coin-flip-loss':
        return 'Perdeu o par-ou-ímpar';
      case 'waiting-player-not-used':
        return 'Ficou fora do campeonato';
      default:
        return 'Prioridade';
    }
  }

  /** Resultado em texto, para colar no grupo do WhatsApp. */
  protected share(): void {
    const tournament = this.store.tournament();
    if (!tournament) {
      return;
    }

    const lines = [
      tournament.name,
      ...this.rows().map((row) => `${row.position}. ${row.label} (${row.record}, ${row.balance})`),
    ];

    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  }

  protected async remove(): Promise<void> {
    this.confirmingDelete.set(false);
    await this.facade.deleteTournament(this.tournamentId());
    void this.router.navigate(['/g', this.group.groupId(), 'campeonatos']);
  }

  protected newDraw(): void {
    const sessionId = this.store.tournament()?.sessionId;
    void this.router.navigate(
      sessionId
        ? ['/g', this.group.groupId(), 'campeonatos', 'sessoes', sessionId, 'sorteio']
        : ['/g', this.group.groupId(), 'campeonatos'],
    );
  }

  protected back(): void {
    void this.router.navigate(['/g', this.group.groupId(), 'campeonatos']);
  }
}
