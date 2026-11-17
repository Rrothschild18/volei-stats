import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { AppFacade } from '../../../core/facade/app.facade';
import { HistoricoDaDupla, historicoDoConfronto } from '../../../core/rules/matchup-stats';
import { Match, Tournament } from '../../../shared/models';
import { IconComponent } from '../../../shared/ui';

interface Cartao {
  readonly titulo: string;
  readonly linhas: readonly string[];
}

/**
 * O histórico das duas duplas, para arrastar de lado (ticket 01).
 *
 * Mora na folha de placar, no lugar em que ficavam o aviso de 0 × 0 e a frase
 * do limite de pontos — dois textos que diziam o que a tela já fazia.
 *
 * Duas regras de comportamento:
 *   - **nunca atrasa o placar**: os números chegam depois, e a falha de carga
 *     esconde o slider em silêncio. A quadra tem 4G ruim, e quem abriu a folha
 *     veio lançar ponto;
 *   - **arrastar não é o único caminho**: as setas e o teclado fazem o mesmo.
 */
@Component({
  selector: 'app-matchup-slider',
  imports: [IconComponent],
  template: `
    @if (cartoes().length > 0) {
      <section
        class="flex flex-col gap-2"
        role="region"
        aria-roledescription="carrossel"
        aria-label="Histórico das duplas"
      >
        <div
          #trilho
          class="flex snap-x snap-mandatory items-start gap-3 overflow-x-auto pb-1 [scrollbar-width:none]"
          tabindex="0"
          (scroll)="aoRolar()"
        >
          @for (cartao of cartoes(); track cartao.titulo; let indice = $index) {
            <article
              class="flex w-full shrink-0 snap-center flex-col gap-1 border border-divider p-3"
              role="group"
              aria-roledescription="slide"
              [attr.aria-label]="indice + 1 + ' de ' + cartoes().length + ': ' + cartao.titulo"
            >
              <h3 class="kicker">{{ cartao.titulo }}</h3>
              @for (linha of cartao.linhas; track linha; let primeira = $first) {
                <p
                  [class]="
                    primeira
                      ? 'font-heading text-[20px] leading-tight font-semibold uppercase'
                      : 'text-[14px]'
                  "
                >
                  {{ linha }}
                </p>
              }
            </article>
          }
        </div>

        <div class="flex items-center justify-between">
          <button
            type="button"
            class="btn btn-ghost btn-icon border-0"
            aria-label="Cartão anterior"
            [disabled]="atual() === 0"
            (click)="ir(atual() - 1)"
          >
            <app-icon name="chevron-left" [size]="20" />
          </button>
          <p class="flex items-center gap-2" aria-live="polite">
            @for (cartao of cartoes(); track cartao.titulo; let indice = $index) {
              <span
                class="size-[7px] border border-accent-700"
                [class.bg-accent-700]="indice === atual()"
                aria-hidden="true"
              ></span>
            }
            <span class="sr-only">Cartão {{ atual() + 1 }} de {{ cartoes().length }}</span>
          </p>
          <button
            type="button"
            class="btn btn-ghost btn-icon border-0"
            aria-label="Próximo cartão"
            [disabled]="atual() === cartoes().length - 1"
            (click)="ir(atual() + 1)"
          >
            <app-icon name="chevron-right" [size]="20" />
          </button>
        </div>
      </section>
    }
  `,
})
export class MatchupSliderComponent {
  private readonly facade = inject(AppFacade);

  readonly teamA = input.required<readonly string[]>();
  readonly teamB = input.required<readonly string[]>();
  readonly teamALabel = input.required<string>();
  readonly teamBLabel = input.required<string>();
  readonly nameOf = input.required<(playerId: string) => string>();

  private readonly trilho = viewChild<ElementRef<HTMLElement>>('trilho');
  private readonly historia = signal<{
    matches: readonly Match[];
    tournaments: readonly Tournament[];
  } | null>(null);
  protected readonly atual = signal(0);

  constructor() {
    // Uma leitura por folha aberta. Falhou? O slider não aparece, e o placar
    // segue lançável — é ele que a pessoa veio fazer.
    effect(() => {
      void Promise.all([this.facade.getMatches(), this.facade.getTournaments()])
        .then(([matches, tournaments]) => this.historia.set({ matches, tournaments }))
        .catch(() => this.historia.set(null));
    });
  }

  protected readonly cartoes = computed<Cartao[]>(() => {
    const historia = this.historia();
    if (!historia) {
      return [];
    }

    const historico = historicoDoConfronto({
      ...historia,
      teamA: this.teamA(),
      teamB: this.teamB(),
    });
    const nome = this.nameOf();

    const confronto: string[] =
      historico.confrontos === 0
        ? ['Primeira vez que estas duplas se enfrentam']
        : [
            `Já se enfrentaram ${this.vezes(historico.confrontos)}`,
            historico.vitoriasDeA === historico.vitoriasDeB
              ? `Empatado em ${historico.vitoriasDeA} a ${historico.vitoriasDeB}.`
              : `${
                  historico.vitoriasDeA > historico.vitoriasDeB
                    ? this.teamALabel()
                    : this.teamBLabel()
                } venceu ${Math.max(historico.vitoriasDeA, historico.vitoriasDeB)} de ${
                  historico.confrontos
                }.`,
          ];

    for (const cruzamento of historico.cruzamentos.slice(0, 4)) {
      confronto.push(
        `${nome(cruzamento.playerA)} × ${nome(cruzamento.playerB)}: ${this.plural(
          cruzamento.jogos,
          'jogo',
          'jogos',
        )}, ${cruzamento.vitoriasDeA} a ${cruzamento.jogos - cruzamento.vitoriasDeA}.`,
      );
    }

    return [
      { titulo: this.teamALabel(), linhas: this.linhasDaDupla(historico.duplaA) },
      { titulo: this.teamBLabel(), linhas: this.linhasDaDupla(historico.duplaB) },
      { titulo: 'O confronto', linhas: confronto },
    ];
  });

  private linhasDaDupla(dupla: HistoricoDaDupla): string[] {
    if (dupla.jogos === 0) {
      return ['Primeira vez juntos', 'Essa dupla ainda não tem história neste vôlei.'];
    }

    return [
      `${this.plural(dupla.jogos, 'jogo junto', 'jogos juntos')} · ${this.plural(
        dupla.vitorias,
        'vitória',
        'vitórias',
      )}`,
      `Média de ${this.decimal(dupla.mediaPro)} × ${this.decimal(dupla.mediaContra)} pontos por jogo.`,
    ];
  }

  protected aoRolar(): void {
    const trilho = this.trilho()?.nativeElement;
    if (trilho && trilho.clientWidth > 0) {
      this.atual.set(Math.round(trilho.scrollLeft / trilho.clientWidth));
    }
  }

  protected ir(indice: number): void {
    const trilho = this.trilho()?.nativeElement;
    if (!trilho) {
      return;
    }
    const alvo = Math.max(0, Math.min(indice, this.cartoes().length - 1));
    trilho.scrollTo({ left: alvo * trilho.clientWidth, behavior: 'smooth' });
    this.atual.set(alvo);
  }

  private vezes(quanto: number): string {
    return quanto === 1 ? 'uma vez' : `${quanto} vezes`;
  }

  private plural(quanto: number, singular: string, plural: string): string {
    return `${quanto} ${quanto === 1 ? singular : plural}`;
  }

  private decimal(valor: number | null): string {
    return valor === null ? '—' : valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  }
}
