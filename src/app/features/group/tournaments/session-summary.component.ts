import { Component, computed, input } from '@angular/core';
import { Match, Player, Tournament } from '../../../shared/models';
import { resumoDaSessao } from '../../../core/rules/session-summary';
import { BlueprintComponent, SectionBandComponent, SpecListComponent } from '../../../shared/ui';
import type { SpecListItem } from '../../../shared/ui';

/**
 * O resumo esportivo da noite (ticket 02).
 *
 * Muda a cada campeonato concluído e zera na próxima sessão — é o contrapeso
 * do mural, que acumula: num contador que só sobe, quem começou hoje fica no
 * fim da lista para sempre, e aqui qualquer um aparece no primeiro dia.
 *
 * Nada aqui é classificação. São elogios: quem mais venceu, quem emendou
 * vitórias, quem levantou taça, o jogo que quase virou e quem apagou a luz da
 * quadra.
 */
@Component({
  selector: 'app-session-summary',
  imports: [BlueprintComponent, SectionBandComponent, SpecListComponent],
  template: `
    @if (items().length > 0) {
      <section>
        <app-section-band [index]="index()" label="RESUMO DA NOITE" />
        <app-blueprint>
          <app-spec-list [items]="items()" [note]="note()" />
        </app-blueprint>
      </section>
    }
  `,
})
export class SessionSummaryComponent {
  readonly tournaments = input.required<readonly Tournament[]>();
  readonly matches = input.required<readonly Match[]>();
  readonly playersById = input.required<ReadonlyMap<string, Player>>();
  readonly index = input('04');

  private readonly resumo = computed(() =>
    resumoDaSessao({ tournaments: this.tournaments(), matches: this.matches() }),
  );

  protected readonly items = computed<SpecListItem[]>(() => {
    const resumo = this.resumo();
    if (resumo.partidas === 0) {
      return [];
    }

    const linhas: SpecListItem[] = [
      { label: 'partidas jogadas', value: this.plural(resumo.partidas, 'jogo', 'jogos') },
    ];

    if (resumo.maisVitorias) {
      linhas.push({
        label: 'mais vitórias',
        value: this.nomes(resumo.maisVitorias.playerIds),
        figure: resumo.maisVitorias.valor,
      });
    }

    if (resumo.maiorSequencia && resumo.maiorSequencia.valor > 1) {
      linhas.push({
        label: 'maior sequência',
        value: this.nomes(resumo.maiorSequencia.playerIds),
        figure: `${resumo.maiorSequencia.valor} seguidas`,
      });
    }

    if (resumo.maisTitulos) {
      linhas.push({
        label: resumo.maisTitulos.valor === 1 ? 'levantou a taça' : 'mais títulos',
        value: this.nomes(resumo.maisTitulos.playerIds),
        figure: resumo.maisTitulos.valor,
      });
    }

    for (const campeao of resumo.campeoes) {
      linhas.push({
        label: `campeões · ${campeao.nome}`,
        value: this.dupla(campeao.playerIds),
        figure: campeao.placar ? `${campeao.placar.vencedor}×${campeao.placar.perdedor}` : '—',
      });
    }

    if (resumo.maisApertada) {
      linhas.push({
        label: 'partida mais apertada',
        value: `${this.dupla(resumo.maisApertada.vencedorIds)} × ${this.dupla(
          resumo.maisApertada.perdedorIds,
        )}`,
        figure: `${resumo.maisApertada.placar.vencedor}×${resumo.maisApertada.placar.perdedor}`,
      });
    }

    if (resumo.fechouAQuadra.length > 0) {
      linhas.push({ label: 'fechou a quadra', value: this.nomes(resumo.fechouAQuadra) });
    }

    if (resumo.duracaoMediaMin !== null) {
      linhas.push({
        label: 'duração média da partida',
        value: `≈ ${resumo.duracaoMediaMin} min`,
      });
    }

    return linhas;
  });

  /**
   * A duração é estimativa, e a tela diz isso: `playedAt` é quando o placar foi
   * lançado, não quando a partida começou.
   */
  protected readonly note = computed(() =>
    this.resumo().duracaoMediaMin !== null
      ? 'Duração estimada pelo intervalo entre os placares do mesmo campeonato.'
      : '',
  );

  private nome(playerId: string): string {
    return this.playersById().get(playerId)?.name ?? '?';
  }

  /** "Douglas e Wily"; com três ou mais, "Douglas, Wily e Kaio". */
  private nomes(playerIds: readonly string[]): string {
    const nomes = playerIds.map((playerId) => this.nome(playerId));
    if (nomes.length <= 1) {
      return nomes[0] ?? '?';
    }
    return `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
  }

  /** A dupla como ela aparece no resto do app: "Douglas + Wily". */
  private dupla(playerIds: readonly string[]): string {
    return playerIds.map((playerId) => this.nome(playerId)).join(' + ');
  }

  private plural(quanto: number, singular: string, plural: string): string {
    return `${quanto} ${quanto === 1 ? singular : plural}`;
  }
}
