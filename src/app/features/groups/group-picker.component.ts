import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { RefreshService } from '../../core/refresh/refresh.service';
import { GroupsStore, GroupSummary } from '../../core/stores/groups.store';
import { formatShortDate } from '../../shared/utils/date.util';
import {
  BlueprintComponent,
  HeroFieldComponent,
  IconComponent,
  PullToRefreshComponent,
  SkeletonComponent,
  StatGridComponent,
} from '../../shared/ui';

/**
 * Seus vôleis: um card por vôlei de que a pessoa participa (1b). O vôlei com
 * sessão ao vivo hoje aparece em destaque.
 *
 */
@Component({
  selector: 'app-group-picker',
  imports: [
    BlueprintComponent,
    HeroFieldComponent,
    IconComponent,
    PullToRefreshComponent,
    SkeletonComponent,
    StatGridComponent,
  ],
  template: `
    <!--
      Sem saudação com nome: o nome é por vôlei. A mesma pessoa é "Raul" num e
      "Raulzinho" no outro, e não existe um nome dela fora deles.
    -->
    <header class="flex items-center justify-between gap-2 px-4 pt-6 pb-4">
      <h1 class="title-xl">SEUS VÔLEIS</h1>
      <app-pull-to-refresh />
    </header>

    <div class="flex flex-col gap-4 px-4">
      <!--
        É a primeira tela depois de abrir o app: o pedido de sessão anônima e a
        leitura dos vôleis acontecem aqui. Em branco ela parece um app que não
        carregou.
      -->
      @if (loading()) {
        <app-skeleton [rows]="3" label="Carregando os seus vôleis…" />
        <app-skeleton [rows]="3" />
      }

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

      @if (error()) {
        <app-blueprint class="p-4">
          <p class="text-[14px]" aria-live="polite">{{ error() }}</p>
          <button type="button" class="btn btn-secondary mt-3 min-h-11 w-full" (click)="retry()">
            TENTAR DE NOVO
          </button>
        </app-blueprint>
      }

      @if (!loading() && !error() && summaries().length === 0) {
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
      </div>

      <button type="button" class="btn btn-secondary min-h-12" (click)="join()">
        ENTRAR EM OUTRO VÔLEI
      </button>
    </div>
  `,
  host: { class: 'block min-h-dvh' },
})
export class GroupPickerComponent implements OnInit {
  private readonly refresh = inject(RefreshService);
  private readonly groups = inject(GroupsStore);
  private readonly router = inject(Router);

  protected readonly summaries = this.groups.summaries;
  protected readonly loading = this.groups.loading;
  protected readonly error = this.groups.error;

  constructor() {
    // Voltar para o app, a rede voltar, ou puxar para atualizar: tudo cai aqui.
    this.refresh.register(() => this.load());
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
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

  protected async retry(): Promise<void> {
    await this.load();
  }

  protected join(): void {
    void this.router.navigate(['/entrar']);
  }

  protected enter(summary: GroupSummary): void {
    void this.router.navigate(['/g', summary.group.id, 'inicio']);
  }
}
