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
 * Para em três letras. Nomes que empatam nas três primeiras (Ana e Ana Paula)
 * ficam com a mesma sigla, e aí é o nome inteiro, que está logo ao lado, que
 * resolve — alargar mais só encheria o círculo.
 */
export function siglas(nomes: readonly string[]): ReadonlyMap<string, string> {
  const chaves = nomes.map(chave);

  return new Map(
    nomes.map((nome, indice) => {
      const minha = chaves[indice];

      for (let tamanho = 1; tamanho < 3; tamanho++) {
        const pedaco = minha.slice(0, tamanho);
        const empata = chaves.some(
          (outra, outroIndice) => outroIndice !== indice && outra.startsWith(pedaco),
        );
        if (!empata) {
          return [nome, nome.slice(0, tamanho).toLocaleUpperCase('pt-BR')];
        }
      }

      return [nome, nome.slice(0, 3).toLocaleUpperCase('pt-BR')];
    }),
  );
}
