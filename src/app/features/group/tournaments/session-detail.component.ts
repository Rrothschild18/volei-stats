import { Component, computed, inject, input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import { SessionStore } from '../../../core/stores/session.store';
import { formatShortDate, todayDateString } from '../../../shared/utils/date.util';
import {
  ActionBarComponent,
  BlueprintComponent,
  GenderBadgeComponent,
  IconComponent,
  InnerHeaderComponent,
  SectionBandComponent,
} from '../../../shared/ui';

/**
 * A sessão do dia (1f): quem está presente, quem já esperou e os campeonatos
 * que já rolaram. Não existe link de sessão — quem é do grupo já a vê.
 */
@Component({
  selector: 'app-session-detail',
  imports: [
    ActionBarComponent,
    BlueprintComponent,
    GenderBadgeComponent,
    IconComponent,
    InnerHeaderComponent,
    SectionBandComponent,
  ],
  template: `
    <app-inner-header [context]="context()" [title]="title()" (back)="back()" />

    <div class="flex flex-col gap-6 px-4 pb-6">
      <section>
        <app-section-band index="01" [label]="'PRESENTES · ' + present().length">
          @if (group.canPlay()) {
            <button type="button" class="text-[13px] text-accent-700" (click)="editPresence()">
              Editar presença
            </button>
          }
        </app-section-band>
        <ul class="flex list-none flex-wrap gap-[6px] p-0">
          @for (player of present(); track player.id) {
            <li
              class="inline-flex h-[30px] items-center gap-2 border border-divider px-[10px] text-[13px]"
            >
              {{ player.name }}
              <app-gender-badge [gender]="player.gender" />
            </li>
          }
        </ul>
      </section>

      <section>
        <app-section-band
          index="02"
          label="REVEZAMENTO DE ESPERA"
          [meta]="waitEntries().length + ' de ' + present().length"
        />
        <app-blueprint>
          @for (entry of waitEntries(); track entry.player.id; let last = $last) {
            <div class="flex items-center gap-3 px-[14px] py-[11px]" [class.row-rule]="!last">
              <app-icon name="hourglass" [size]="18" class="muted" />
              <span class="font-heading text-[17px] font-semibold uppercase">{{
                entry.player.name
              }}</span>
              <span class="flex-1 text-right text-[13px] muted">{{ entry.reason }}</span>
            </div>
          } @empty {
            <p class="px-[14px] py-3 text-[13px] muted">Ninguém esperou ainda hoje.</p>
          }
        </app-blueprint>
        <p class="mt-2 text-[12px] muted">
          No próximo sorteio, a espera sai só entre os
          <strong class="font-semibold">{{ yetToWait() }} que ainda não esperaram hoje</strong>.
          Ninguém espera duas vezes antes de todos esperarem uma.
        </p>
      </section>

      <section>
        <app-section-band index="03" label="CAMPEONATOS DO DIA" />
        <app-blueprint>
          @for (row of tournamentRows(); track row.id; let last = $last) {
            <button
              type="button"
              class="flex w-full items-center gap-3 px-[14px] py-[13px] text-left"
              [class.row-rule]="!last"
              (click)="openTournament(row.id, row.live)"
            >
              <span class="min-w-0 flex-1">
                <span class="block font-heading text-[18px] leading-tight font-semibold uppercase">
                  {{ row.title }}
                </span>
                <span
                  class="flex items-center gap-1 text-[13px]"
                  [class]="row.live ? 'text-accent-700 font-medium' : 'muted'"
                >
                  @if (row.live) {
                    <span class="size-[7px] bg-accent-700" aria-hidden="true"></span>
                  }
                  {{ row.detail }}
                </span>
              </span>
              <app-icon name="chevron-right" [size]="18" class="muted" />
            </button>
          } @empty {
            <p class="px-[14px] py-3 text-[13px] muted">
              Nenhum campeonato ainda. O próximo passo é sortear as duplas.
            </p>
          }
        </app-blueprint>
      </section>
    </div>

    @if (group.canPlay()) {
      <app-action-bar [pair]="true" [withTabBar]="true">
        <button type="button" class="btn btn-secondary h-13" (click)="editPresence()">
          PRESENÇA
        </button>
        <button type="button" class="btn btn-primary blueprint h-13 text-[17px]" (click)="draw()">
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i>
          <i class="corner br"></i>
          <app-icon name="dices" [size]="20" />
          NOVO SORTEIO
        </button>
      </app-action-bar>
    }
  `,
  host: { class: 'block' },
})
export class SessionDetailComponent implements OnInit {
  private readonly router = inject(Router);
  protected readonly group = inject(CurrentGroupStore);
  protected readonly store = inject(SessionStore);

  readonly sessionId = input.required<string>();

  protected readonly present = this.store.present;
  protected readonly waitEntries = this.store.waitEntries;
  protected readonly yetToWait = this.store.yetToWait;

  protected readonly context = computed(() => {
    const date = this.store.session()?.date;
    return `CAMPEONATOS · ${date ? formatShortDate(date) : ''}`;
  });

  protected readonly title = computed(() =>
    this.store.session()?.date === todayDateString() ? 'SESSÃO DE HOJE' : 'SESSÃO',
  );

  protected readonly tournamentRows = computed(() =>
    this.store
      .tournaments()
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((tournament, _index, all) => {
        const order = all.length - all.indexOf(tournament);
        const live = tournament.status === 'in-progress';
        const champion = tournament.finalStandings.find((standing) => standing.position === 1);
        const team = champion
          ? tournament.teams.find((candidate) => candidate.id === champion.teamId)
          : null;
        const byId = this.store.playersById();

        return {
          id: tournament.id,
          live,
          title: `${String(order).padStart(2, '0')} · ${tournament.name.toUpperCase()}`,
          detail: live
            ? 'Ao vivo'
            : team
              ? `Campeões · ${team.playerIds.map((playerId) => byId.get(playerId)?.name ?? '?').join(' + ')}`
              : 'Finalizado',
        };
      }),
  );

  async ngOnInit(): Promise<void> {
    await this.store.loadById(this.sessionId());
  }

  protected editPresence(): void {
    void this.router.navigate(['/g', this.group.groupId(), 'campeonatos', 'sessoes', 'nova'], {
      queryParams: { sessionId: this.sessionId() },
    });
  }

  protected draw(): void {
    void this.router.navigate([
      '/g',
      this.group.groupId(),
      'campeonatos',
      'sessoes',
      this.sessionId(),
      'sorteio',
    ]);
  }

  protected openTournament(tournamentId: string, live: boolean): void {
    const base = ['/g', this.group.groupId(), 'campeonatos', tournamentId];
    void this.router.navigate(live ? base : [...base, 'classificacao']);
  }

  protected back(): void {
    void this.router.navigate(['/g', this.group.groupId(), 'campeonatos']);
  }
}
