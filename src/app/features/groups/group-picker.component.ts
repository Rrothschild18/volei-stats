import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppFacade } from '../../core/facade/app.facade';
import { GroupsStore, GroupSummary } from '../../core/stores/groups.store';
import { MockIdentityService } from '../../core/mock/mock-identity.service';
import { Player } from '../../shared/models';
import { formatShortDate } from '../../shared/utils/date.util';
import {
  BlueprintComponent,
  HeroFieldComponent,
  IconComponent,
  StatGridComponent,
} from '../../shared/ui';

/**
 * Seus vôleis: um card por vôlei de que a pessoa participa (1b). O vôlei com
 * sessão ao vivo hoje aparece em destaque.
 *
 * A seção do fim é do mock: sem backend, é por ali que se assume outra pessoa
 * para ver o app pelos olhos dela. Ela sai no ticket 20.
 */
@Component({
  selector: 'app-group-picker',
  imports: [BlueprintComponent, HeroFieldComponent, IconComponent, StatGridComponent],
  template: `
    <header class="px-4 pt-6 pb-4">
      <div class="flex items-center gap-3">
        <span
          class="flex size-9 items-center justify-center border border-divider font-heading text-[18px] font-semibold"
          aria-hidden="true"
          >{{ initial() }}</span
        >
        <p class="kicker">OLÁ, {{ me()?.name?.toUpperCase() }}</p>
      </div>
      <h1 class="title-xl mt-2">SEUS VÔLEIS</h1>
    </header>

    <div class="flex flex-col gap-4 px-4">
      @for (summary of summaries(); track summary.group.id) {
        @if (summary.liveTournament) {
          <app-hero-field kicker="HOJE · SESSÃO AO VIVO" [live]="true">
            <div class="flex items-start justify-between gap-2">
              <h2 class="font-heading text-[28px] leading-none font-semibold uppercase">
                {{ summary.group.name }}
              </h2>
              <span class="tag border border-accent-400 text-accent-200">{{
                roleLabel(summary)
              }}</span>
            </div>

            <button
              type="button"
              class="flex items-center gap-2 border-t border-accent-700 pt-3 text-left"
              (click)="enter(summary)"
            >
              <span class="flex-1">
                @if (summary.myNextMatch) {
                  <span class="block text-[12px] tracking-[0.08em] text-accent-300 uppercase"
                    >VOCÊ JOGA AGORA</span
                  >
                  <span class="block font-heading text-[17px] font-semibold uppercase">
                    {{ summary.myNextMatch.phaseLabel }} × {{ summary.myNextMatch.opponent }}
                  </span>
                } @else {
                  <span class="block text-[12px] tracking-[0.08em] text-accent-300 uppercase"
                    >CAMPEONATO EM ANDAMENTO</span
                  >
                  <span class="block font-heading text-[17px] font-semibold uppercase">
                    {{ summary.liveTournament.name }}
                  </span>
                }
              </span>
              <app-icon name="chevron-right" [size]="20" />
            </button>

            <div class="grid grid-cols-3 border border-accent-700">
              @for (stat of liveStats(summary); track stat.label) {
                <div class="px-2 py-2 not-first:border-l not-first:border-accent-700">
                  <p class="figure text-[22px]">{{ stat.value }}</p>
                  <p class="text-[11px] text-accent-200">{{ stat.label }}</p>
                </div>
              }
            </div>
          </app-hero-field>
        } @else {
          <app-blueprint>
            <button
              type="button"
              class="flex w-full flex-col gap-3 p-4 text-left"
              (click)="enter(summary)"
            >
              <span class="flex w-full items-start justify-between gap-2">
                <span class="font-heading text-[28px] leading-none font-semibold uppercase">
                  {{ summary.group.name }}
                </span>
                <span class="tag tag-neutral">{{ roleLabel(summary) }}</span>
              </span>

              <span class="flex items-center gap-2 text-[13px] muted">
                <app-icon name="calendar" [size]="16" />
                @if (summary.nextSessionDate) {
                  Última sessão · {{ shortDate(summary.nextSessionDate) }}
                } @else {
                  Sem sessão hoje
                }
              </span>

              <app-stat-grid class="w-full" [items]="groupStats(summary)" />
            </button>
          </app-blueprint>
        }
      }

      @if (!loading() && summaries().length === 0) {
        <app-blueprint class="p-4">
          <p class="text-[14px]">
            Você ainda não está em nenhum vôlei. Peça o link a quem organiza um, ou crie o seu.
          </p>
        </app-blueprint>
      }

      <div class="flex flex-col gap-1 text-[13px] muted">
        <p>
          Em todos os seus vôleis você marca presença, tira sorteio e lança placar. Dono é quem
          criou o vôlei: só ele cadastra gente e apaga coisa.
        </p>
        <p>Para entrar em outro vôlei, peça o link a quem é dono dele.</p>
      </div>

      <app-blueprint class="mt-2 mb-8 p-4">
        <p class="kicker">MOCK · SEM BACKEND</p>
        <h2 class="font-heading text-[20px] font-semibold uppercase">Entrar como</h2>
        <p class="mt-1 mb-3 text-[13px] muted">
          Enquanto não há login, dá para assumir qualquer pessoa do cenário e ver o app pelos olhos
          dela. Rafa é dono do Vôlei Segunda; Caio joga lá e é dono do Vôlei Trabalho.
        </p>
        <div class="flex flex-wrap gap-2">
          @for (player of everyone(); track player.id) {
            <button
              type="button"
              class="btn btn-secondary min-h-9 px-3 text-[13px] normal-case"
              [class.btn-primary]="player.id === currentPlayerId()"
              (click)="switchTo(player.id)"
            >
              {{ player.name }}
            </button>
          }
        </div>
      </app-blueprint>
    </div>
  `,
  host: { class: 'block min-h-dvh' },
})
export class GroupPickerComponent implements OnInit {
  private readonly facade = inject(AppFacade);
  private readonly identity = inject(MockIdentityService);
  private readonly groups = inject(GroupsStore);
  private readonly router = inject(Router);

  protected readonly summaries = this.groups.summaries;
  protected readonly loading = this.groups.loading;
  protected readonly currentPlayerId = this.identity.playerId;
  protected readonly everyone = signal<readonly Player[]>([]);
  protected readonly me = computed(
    () => this.everyone().find((player) => player.id === this.currentPlayerId()) ?? null,
  );
  protected readonly initial = computed(() => this.me()?.name.charAt(0).toUpperCase() ?? '?');

  async ngOnInit(): Promise<void> {
    this.everyone.set(await this.facade.getPlayers());
    await this.groups.load();
  }

  protected roleLabel(summary: GroupSummary): string {
    if (summary.isOwner) {
      return 'DONO';
    }
    return summary.role === 'player' ? 'JOGADOR' : 'VISITANTE';
  }

  protected shortDate(date: string): string {
    return formatShortDate(date);
  }

  protected groupStats(summary: GroupSummary) {
    return [
      { value: summary.gamesPlayed, label: 'jogos' },
      { value: summary.rankingPosition ? `${summary.rankingPosition}º` : '—', label: 'no ranking' },
      { value: summary.playerCount, label: 'jogadores' },
    ];
  }

  protected liveStats(summary: GroupSummary) {
    return this.groupStats(summary);
  }

  protected enter(summary: GroupSummary): void {
    void this.router.navigate(['/g', summary.group.id, 'inicio']);
  }

  protected async switchTo(playerId: string): Promise<void> {
    this.identity.setPlayerId(playerId);
    await this.groups.load();
  }
}
