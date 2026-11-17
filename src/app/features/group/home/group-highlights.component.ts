import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { AppFacade } from '../../../core/facade/app.facade';
import { destaquesDoGrupo } from '../../../core/rules/group-highlights';
import { PartidaDestaque } from '../../../core/rules/session-summary';
import {
  JANELA_PADRAO,
  lastSessionIds,
  noitesComCampeonato,
} from '../../../core/rules/stats-window';
import { Match, Player, Session, Tournament } from '../../../shared/models';
import { formatShortDate } from '../../../shared/utils/date.util';
import { BlueprintComponent, SectionBandComponent, SpecListComponent } from '../../../shared/ui';
import type { SpecListItem } from '../../../shared/ui';
import { SessionSummaryComponent } from '../tournaments/session-summary.component';

interface Historia {
  readonly players: readonly Player[];
  readonly sessions: readonly Session[];
  readonly tournaments: readonly Tournament[];
  readonly matches: readonly Match[];
}

/**
 * As três faixas da home (ticket 06): o que o vôlei tem a comemorar.
 *
 *   - **Mural**: acumula nas últimas noites — quem vem sempre aparece;
 *   - **A última noite**: zera toda semana — quem começou hoje aparece;
 *   - **Recordes**: nunca zeram.
 *
 * As três existem juntas porque cada uma conserta o defeito da outra: contador
 * que só sobe deixa o novato no fim para sempre, e destaque que zera não guarda
 * a história de ninguém.
 *
 * Nenhum `%` e nenhum "pior": aproveitamento é ranking disfarçado, e a home é
 * para parabenizar.
 */
@Component({
  selector: 'app-group-highlights',
  imports: [BlueprintComponent, SectionBandComponent, SessionSummaryComponent, SpecListComponent],
  template: `
    @if (mural().length > 0) {
      <section class="px-4">
        <app-section-band index="01" label="MURAL">
          <span class="text-[13px] muted">{{ recorte() }}</span>
        </app-section-band>
        <app-blueprint>
          <app-spec-list [items]="mural()" />
        </app-blueprint>
      </section>
    }

    @if (ultimaNoite(); as noite) {
      <div class="px-4">
        <app-session-summary
          index="02"
          [label]="'A ÚLTIMA NOITE · ' + noite.dia.toUpperCase()"
          [tournaments]="noite.tournaments"
          [matches]="noite.matches"
          [playersById]="playersById()"
          [titulo]="groupName()"
          [subtitulo]="noite.dia"
        />
      </div>
    }

    @if (recordes().length > 0) {
      <section class="px-4">
        <app-section-band index="03" label="RECORDES DO GRUPO">
          <span class="text-[13px] muted">desde sempre</span>
        </app-section-band>
        <app-blueprint>
          <app-spec-list [items]="recordes()" />
        </app-blueprint>
      </section>
    }
  `,
  host: { class: 'flex flex-col gap-5' },
})
export class GroupHighlightsComponent {
  private readonly facade = inject(AppFacade);

  readonly groupId = input.required<string>();
  readonly groupName = input.required<string>();
  /** Muda quando a home recarrega: é o sinal para reler a história. */
  readonly versao = input(0);

  private readonly historia = signal<Historia | null>(null);

  constructor() {
    effect(() => {
      const groupId = this.groupId();
      this.versao();
      void this.carregar(groupId);
    });
  }

  protected readonly playersById = computed(
    () => new Map((this.historia()?.players ?? []).map((player) => [player.id, player])),
  );

  private readonly janela = computed(() =>
    lastSessionIds(noitesComCampeonato(this.historia()?.sessions ?? []), JANELA_PADRAO),
  );

  /** O que o mural está somando, dito na faixa — um vôlei novo tem menos de 4 noites. */
  protected readonly recorte = computed(() => {
    const noites = this.janela().size;
    return noites >= JANELA_PADRAO
      ? `últimas ${JANELA_PADRAO} noites`
      : noites === 1
        ? '1 noite'
        : `${noites} noites`;
  });

  private readonly destaques = computed(() => {
    const historia = this.historia();
    return historia
      ? destaquesDoGrupo({
          matches: historia.matches,
          tournaments: historia.tournaments,
          janela: this.janela(),
        })
      : null;
  });

  protected readonly mural = computed<SpecListItem[]>(() => {
    const destaques = this.destaques();
    if (!destaques) {
      return [];
    }

    const linhas: SpecListItem[] = [];

    if (destaques.maisVitorias) {
      linhas.push({
        label: 'mais vitórias',
        value: this.nomes(destaques.maisVitorias.playerIds),
        figure: destaques.maisVitorias.valor,
      });
    }
    if (destaques.emSequencia) {
      linhas.push({
        label: 'em sequência agora',
        value: this.nomes(destaques.emSequencia.playerIds),
        figure: `${destaques.emSequencia.valor} seguidas`,
      });
    }
    if (destaques.maisPontos) {
      linhas.push({
        label: 'mais pontos marcados',
        value: this.nomes(destaques.maisPontos.playerIds),
        figure: destaques.maisPontos.valor,
      });
    }
    if (destaques.maisTitulos) {
      linhas.push({
        label: 'mais títulos',
        value: this.nomes(destaques.maisTitulos.playerIds),
        figure: destaques.maisTitulos.valor,
      });
    }
    // As duas de baixo são de todos os tempos: dupla quase não se repete, e a
    // janela de 4 noites deixaria as duas linhas vazias.
    if (destaques.duplaDoCoracao) {
      linhas.push({
        label: 'dupla do coração · desde sempre',
        value: destaques.duplaDoCoracao.playerIds.map((id) => this.nome(id)).join(' + '),
        figure: `${destaques.duplaDoCoracao.jogos} jogos`,
      });
    }
    if (destaques.classico) {
      linhas.push({
        label: 'o clássico · desde sempre',
        value: destaques.classico.playerIds.map((id) => this.nome(id)).join(' × '),
        figure: `${destaques.classico.jogos} jogos`,
      });
    }

    return linhas;
  });

  protected readonly recordes = computed<SpecListItem[]>(() => {
    const destaques = this.destaques();
    if (!destaques) {
      return [];
    }

    const linhas: SpecListItem[] = [];

    if (destaques.recordeDeSequencia) {
      linhas.push({
        label: 'maior sequência da história',
        value: this.nomes(destaques.recordeDeSequencia.playerIds),
        figure: `${destaques.recordeDeSequencia.valor} seguidas`,
      });
    }
    if (destaques.maisElastico) {
      linhas.push(this.partida('placar mais elástico', destaques.maisElastico));
    }
    if (
      destaques.maisDisputado &&
      destaques.maisDisputado.matchId !== destaques.maisElastico?.matchId
    ) {
      linhas.push(this.partida('jogo mais disputado', destaques.maisDisputado));
    }

    return linhas;
  });

  /** A noite mais recente que teve jogo: é dela o resumo do meio. */
  protected readonly ultimaNoite = computed(() => {
    const historia = this.historia();
    if (!historia) {
      return null;
    }

    const comJogo = new Set(historia.matches.map((match) => match.sessionId));
    const session = [...historia.sessions]
      .filter((candidate) => comJogo.has(candidate.id))
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    return session
      ? {
          dia: formatShortDate(session.date),
          tournaments: historia.tournaments.filter((entry) => entry.sessionId === session.id),
          matches: historia.matches.filter((entry) => entry.sessionId === session.id),
        }
      : null;
  });

  private async carregar(groupId: string): Promise<void> {
    try {
      const [players, sessions, tournaments, matches] = await Promise.all([
        this.facade.getPlayersByGroupId(groupId),
        this.facade.getSessionsByGroupId(groupId),
        this.facade.getTournaments(),
        this.facade.getMatches(),
      ]);
      const doGrupo = new Set(sessions.map((session) => session.id));

      this.historia.set({
        players,
        sessions,
        tournaments: tournaments.filter((entry) => doGrupo.has(entry.sessionId)),
        matches: matches.filter((entry) => doGrupo.has(entry.sessionId)),
      });
    } catch {
      // As faixas são enfeite da home: se não vieram, a home segue sem elas.
      this.historia.set(null);
    }
  }

  private partida(label: string, destaque: PartidaDestaque): SpecListItem {
    return {
      label,
      value: `${this.dupla(destaque.vencedorIds)} × ${this.dupla(destaque.perdedorIds)}`,
      figure: `${destaque.placar.vencedor}×${destaque.placar.perdedor}`,
    };
  }

  private nome(playerId: string): string {
    return this.playersById().get(playerId)?.name ?? '?';
  }

  private nomes(playerIds: readonly string[]): string {
    const nomes = playerIds.map((playerId) => this.nome(playerId));
    return nomes.length <= 1
      ? (nomes[0] ?? '?')
      : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
  }

  private dupla(playerIds: readonly string[]): string {
    return playerIds.map((playerId) => this.nome(playerId)).join(' + ');
  }
}
