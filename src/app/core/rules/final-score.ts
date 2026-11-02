/**
 * Quando um placar é um placar de fim de jogo.
 *
 * O limite de pontos era só um aviso (REGRAS.md §8.3): dava para salvar 12 × 11
 * e 18 × 3 com limite 12, e os dois são jogos que não existiram. Vôlei acaba no
 * limite **com dois de diferença** — e, sem os dois, continua até alguém abrir
 * essa vantagem. Com limite 12: 12 × 10 acaba, 12 × 11 não, 14 × 12 acaba.
 *
 * O que NÃO entra aqui: partida interrompida. Acabou o horário da quadra,
 * começou a chover, e o jogo para em 7 × 5. Isso acontece e precisa ser
 * registrável — por isso "abaixo do limite" continua sendo pergunta, e não
 * recusa. A regra dos dois pontos vale para o jogo que chegou ao fim.
 */
export type FinalScoreVerdict =
  /** Placar de fim de jogo. */
  | 'ok'
  /** Ninguém jogou 0 × 0. */
  | 'zero'
  /** Vôlei não tem empate. */
  | 'tie'
  /** Parou antes do limite: pergunta, não recusa. */
  | 'below-limit'
  /** Chegou ao limite empurrando, mas sem os dois pontos de vantagem. */
  | 'needs-two'
  /** Passou do limite num ponto em que o jogo já teria acabado. */
  | 'past-limit';

export function readFinalScore(scoreA: number, scoreB: number, limit: number): FinalScoreVerdict {
  if (scoreA === scoreB) {
    return scoreA === 0 ? 'zero' : 'tie';
  }

  const winner = Math.max(scoreA, scoreB);
  const loser = Math.min(scoreA, scoreB);

  // Jogo que não chegou ao limite: é o caso do jogo interrompido, e quem decide
  // se vale é quem estava na quadra.
  if (winner < limit) {
    return 'below-limit';
  }

  // No limite exato, basta a diferença de dois: 12 × 10 com limite 12.
  if (winner === limit) {
    return winner - loser >= 2 ? 'ok' : 'needs-two';
  }

  // Passou do limite: só existe empurrando o empate, e aí o jogo para no
  // instante em que alguém abre dois. 14 × 12 existe; 14 × 11 não, porque o
  // jogo teria acabado em 13 × 11.
  return winner === loser + 2 ? 'ok' : 'past-limit';
}

/**
 * O placar que o jogo teria tido se tivesse parado na hora certa.
 *
 * Serve para a mensagem de erro dizer o que fazer em vez de só dizer que está
 * errado — "com limite 12, o jogo pararia em 13 × 11".
 */
export function expectedStop(scoreA: number, scoreB: number, limit: number): [number, number] {
  const loser = Math.min(scoreA, scoreB);
  const winner = loser <= limit - 2 ? limit : loser + 2;
  return scoreA >= scoreB ? [winner, loser] : [loser, winner];
}

/**
 * Até onde o placar de um lado pode subir, dado o que o outro lado fez.
 *
 * É a mesma regra vista do outro lado: em vez de julgar um placar pronto, diz
 * onde o `+` da folha para. Com o adversário longe do limite, o teto é o
 * próprio limite — 13 × 0 num campeonato de 12 é um jogo que teria acabado em
 * 12 × 0. Com o adversário a um ponto do limite ou além, o jogo está no
 * empurrado do empate, e o teto anda junto: dois acima de quem está atrás.
 *
 * O passo intermediário continua permitido: em 12 × 11 o `+` não some, ele leva
 * a 13 × 11. O que não dá é PARAR num placar que não existiu.
 */
export function scoreCeiling(other: number, limit: number): number {
  return other >= limit - 1 ? other + 2 : limit;
}
