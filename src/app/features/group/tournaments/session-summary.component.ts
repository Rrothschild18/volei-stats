import { Component, computed, input } from '@angular/core';
import { Match, Player, Tournament } from '../../../shared/models';
import { resumoDaSessao } from '../../../core/rules/session-summary';
import { linhasDoResumo } from '../../../core/rules/session-summary-lines';
import { SummaryShareButtonComponent } from './summary-share-button.component';
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
  imports: [
    BlueprintComponent,
    SectionBandComponent,
    SpecListComponent,
    SummaryShareButtonComponent,
  ],
  template: `
    @if (items().length > 0) {
      <section>
        <app-section-band [index]="index()" [label]="label()" />
        <app-blueprint>
          <app-spec-list [items]="items()" />
          <!--
            Onde ficava a nota da duração agora fica o gesto: o resumo inteiro
            vira imagem e vai para o grupo. O "≈" na linha da duração continua
            dizendo que ela é estimativa.
          -->
          <div class="border-t border-divider p-3">
            <app-summary-share-button
              [tournaments]="tournaments()"
              [matches]="matches()"
              [playersById]="playersById()"
              [titulo]="titulo()"
              [subtitulo]="subtitulo()"
            />
          </div>
        </app-blueprint>
      </section>
    }
  `,
})
export class SessionSummaryComponent {
  readonly tournaments = input.required<readonly Tournament[]>();
  readonly matches = input.required<readonly Match[]>();
  readonly playersById = input.required<ReadonlyMap<string, Player>>();
  /** O vôlei e o dia: o cabeçalho da imagem compartilhada. */
  readonly titulo = input.required<string>();
  readonly subtitulo = input.required<string>();
  readonly index = input('04');
  readonly label = input('RESUMO DA NOITE');

  protected readonly items = computed<SpecListItem[]>(() =>
    linhasDoResumo(
      resumoDaSessao({ tournaments: this.tournaments(), matches: this.matches() }),
      (playerId) => this.playersById().get(playerId)?.name ?? '?',
    ),
  );
}
