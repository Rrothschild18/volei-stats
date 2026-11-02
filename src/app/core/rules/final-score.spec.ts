import { describe, expect, it } from 'vitest';
import { expectedStop, readFinalScore, scoreCeiling } from './final-score';

/** O limite padrão do app, e o que quase todo campeonato usa. */
const LIMITE = 12;

describe('readFinalScore', () => {
  it('o jogo acaba no limite com dois de diferença', () => {
    expect(readFinalScore(12, 10, LIMITE)).toBe('ok');
    expect(readFinalScore(12, 0, LIMITE)).toBe('ok');
    expect(readFinalScore(10, 12, LIMITE)).toBe('ok');
  });

  it('no limite com um ponto de diferença, o jogo continua', () => {
    expect(readFinalScore(12, 11, LIMITE)).toBe('needs-two');
    expect(readFinalScore(11, 12, LIMITE)).toBe('needs-two');
  });

  it('e aí ele vai até alguém abrir dois', () => {
    expect(readFinalScore(13, 11, LIMITE)).toBe('ok');
    expect(readFinalScore(14, 12, LIMITE)).toBe('ok');
    expect(readFinalScore(18, 16, LIMITE)).toBe('ok');
    expect(readFinalScore(16, 18, LIMITE)).toBe('ok');
  });

  it('passar do limite de outro jeito é placar que não existiu', () => {
    // O jogo teria acabado em 12 × 9.
    expect(readFinalScore(13, 9, LIMITE)).toBe('past-limit');
    // E este, em 13 × 11.
    expect(readFinalScore(14, 11, LIMITE)).toBe('past-limit');
    expect(readFinalScore(18, 3, LIMITE)).toBe('past-limit');
  });

  it('parar antes do limite é pergunta, não recusa: jogo interrompido existe', () => {
    expect(readFinalScore(7, 5, LIMITE)).toBe('below-limit');
    // Até sem os dois de diferença: quem parou o jogo parou onde estava.
    expect(readFinalScore(10, 9, LIMITE)).toBe('below-limit');
  });

  it('empate e 0 × 0 continuam fora', () => {
    expect(readFinalScore(0, 0, LIMITE)).toBe('zero');
    expect(readFinalScore(11, 11, LIMITE)).toBe('tie');
  });

  it('vale para qualquer limite, não só o padrão', () => {
    expect(readFinalScore(15, 13, 15)).toBe('ok');
    expect(readFinalScore(15, 14, 15)).toBe('needs-two');
    expect(readFinalScore(16, 14, 15)).toBe('ok');

    expect(readFinalScore(21, 19, 21)).toBe('ok');
    expect(readFinalScore(22, 19, 21)).toBe('past-limit');
  });
});

describe('expectedStop', () => {
  it('diz onde o jogo teria parado, mantendo quem estava ganhando', () => {
    expect(expectedStop(13, 9, LIMITE)).toEqual([12, 9]);
    expect(expectedStop(9, 13, LIMITE)).toEqual([9, 12]);
  });

  it('e, no empurrado, nos dois pontos acima do perdedor', () => {
    expect(expectedStop(14, 11, LIMITE)).toEqual([13, 11]);
    expect(expectedStop(12, 11, LIMITE)).toEqual([13, 11]);
  });
});

describe('scoreCeiling', () => {
  it('com o adversário longe do limite, o teto é o limite', () => {
    expect(scoreCeiling(0, LIMITE)).toBe(12);
    expect(scoreCeiling(9, LIMITE)).toBe(12);
    expect(scoreCeiling(10, LIMITE)).toBe(12);
  });

  it('a um ponto do limite, o jogo entra no empurrado e o teto anda junto', () => {
    expect(scoreCeiling(11, LIMITE)).toBe(13);
    expect(scoreCeiling(12, LIMITE)).toBe(14);
    expect(scoreCeiling(16, LIMITE)).toBe(18);
  });

  it('o teto deixa passar pelo placar intermediário', () => {
    // Em 12 × 11 o `+` não some: ele leva a 13 × 11, que é fim de jogo.
    expect(readFinalScore(12, 11, LIMITE)).toBe('needs-two');
    expect(scoreCeiling(11, LIMITE)).toBeGreaterThan(12);
  });

  it('e nunca deixa parar num placar que não existiu', () => {
    // Todo placar no teto, ou abaixo dele, é salvável ou é pergunta.
    for (let outro = 0; outro <= 20; outro += 1) {
      const teto = scoreCeiling(outro, LIMITE);
      expect(readFinalScore(teto, outro, LIMITE), `${teto} × ${outro}`).not.toBe('past-limit');
      expect(readFinalScore(teto + 1, outro, LIMITE), `${teto + 1} × ${outro}`).toBe('past-limit');
    }
  });
});
