import { Component, computed, input } from '@angular/core';

/**
 * O lugar de uma informação que ainda não chegou.
 *
 * Existe porque a alternativa era pior que uma tela em branco: enquanto o banco
 * respondia, as telas caíam no `@empty` e diziam "Nenhum campeonato ainda",
 * "Ninguém esperou ainda hoje", "Nenhuma sessão anterior". Dois segundos de uma
 * frase que não é verdade, e depois a lista aparecendo por cima — quem lê
 * rápido acredita na primeira.
 *
 * Por isso é esqueleto e não "Carregando…": ele ocupa o espaço e a forma do que
 * vem, então a tela não dá um salto quando o conteúdo chega.
 *
 * Para quem usa leitor de tela, barras cinzas não são informação — elas ficam
 * escondidas, e quem fala é o `role="status"` com a frase. É também por isso
 * que o esqueleto traz o próprio anúncio em vez de deixar cada tela montar o
 * seu: anúncio é fácil de esquecer, e esqueleto sem ele é uma tela que, para
 * quem não enxerga, simplesmente não tem nada.
 */
@Component({
  selector: 'app-skeleton',
  template: `
    <span class="sr-only">{{ label() }}</span>

    @for (largura of linhas(); track $index) {
      <span class="skeleton" aria-hidden="true" [style.width.%]="largura"></span>
    }
  `,
  host: {
    class: 'flex flex-col gap-[10px]',
    role: 'status',
  },
})
export class SkeletonComponent {
  /** Quantas barras. Uma por linha do que vai aparecer ali. */
  readonly rows = input(3);

  /** O que o leitor de tela anuncia. Diga o que está vindo, não "aguarde". */
  readonly label = input('Carregando…');

  /**
   * Larguras que se repetem, em porcentagem.
   *
   * Desiguais de propósito: barras do mesmo tamanho leem como tabela, e o que
   * está vindo é texto de comprimento variado — nome de dupla, de jogador.
   */
  protected readonly linhas = computed(() => {
    const padrao = [92, 74, 85, 63];
    return Array.from({ length: Math.max(1, this.rows()) }, (_, i) => padrao[i % padrao.length]);
  });
}
