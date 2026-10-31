/** O que cabe no círculo de 36px em Barlow Condensed. */
const MAXIMO = 5;

/** Sem acento e em maiúsculas, só para comparar — o que a tela mostra é o original. */
function chave(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleUpperCase('pt-BR');
}

/**
 * A sigla de cada nome: o menor pedaço que não se confunde com os outros.
 *
 * Um vôlei com Raul, Raphael e Rafael tinha três círculos "R" — a sigla não
 * dizia nada, e distinguir dependia de ler o nome ao lado. Aqui cada um cresce
 * só até deixar de empatar: `R` sozinho se ninguém mais começa com R, `RAU`,
 * `RAP` e `RAF` quando os três estão juntos.
 *
 * Para em cinco letras, porque é o que cabe no círculo em letra condensada.
 * Cinco separa os pares que de fato aparecem num vôlei — Pedro de Pedrinho,
 * Will de Willy —, que três não separavam. Quem ainda empata aí (Ana e Ana
 * Paula) fica com a mesma sigla, e aí é o nome inteiro, logo ao lado, que
 * resolve: alargar mais transformaria o círculo num segundo campo de nome.
 */
export function siglas(nomes: readonly string[]): ReadonlyMap<string, string> {
  const chaves = nomes.map(chave);

  return new Map(
    nomes.map((nome, indice) => {
      const minha = chaves[indice];

      for (let tamanho = 1; tamanho < MAXIMO; tamanho++) {
        const pedaco = minha.slice(0, tamanho);
        const empata = chaves.some(
          (outra, outroIndice) => outroIndice !== indice && outra.startsWith(pedaco),
        );
        if (!empata) {
          return [nome, nome.slice(0, tamanho).toLocaleUpperCase('pt-BR')];
        }
      }

      return [nome, nome.slice(0, MAXIMO).toLocaleUpperCase('pt-BR')];
    }),
  );
}
