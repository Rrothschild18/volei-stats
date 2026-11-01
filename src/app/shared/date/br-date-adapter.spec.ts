import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { BrDateAdapter } from './br-date-adapter';
import { paraIso } from '../ui/date-field/date-field.component';

/**
 * Duas armadilhas moram aqui, e as duas aparecem como "o dia anterior".
 */
describe('BrDateAdapter', () => {
  TestBed.configureTestingModule({
    providers: [BrDateAdapter, { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' }],
  });
  const adapter = TestBed.inject(BrDateAdapter);

  it('lê a data do jeito que se digita aqui', () => {
    expect(paraIso(adapter.parse('23/07/1988'))).toBe('1988-07-23');
    expect(paraIso(adapter.parse('23-07-1988'))).toBe('1988-07-23');
    expect(paraIso(adapter.parse('23071988'))).toBe('1988-07-23');
    expect(paraIso(adapter.parse('5/3/1990'))).toBe('1990-03-05');
  });

  it('não lê dd/mm como mês/dia, que é o que o adaptador nativo faria', () => {
    // 07/03 é 7 de março, não 3 de julho.
    expect(paraIso(adapter.parse('07/03/1990'))).toBe('1990-03-07');
  });

  it('não desloca o dia por causa de fuso', () => {
    // `new Date('1988-07-23')` é meia-noite em UTC: a oeste de Greenwich isso
    // cai no dia 22, e a pessoa via a data errada ao reabrir a tela.
    expect(paraIso(adapter.parse('23/07/1988'))).toBe('1988-07-23');
    expect(paraIso(adapter.parse('01/01/1990'))).toBe('1990-01-01');
  });

  it('recusa data que não existe, em vez de acomodar', () => {
    // O `Date` transformaria 31/02 em 02/03 sem reclamar. Numa data de
    // nascimento isso é erro de digitação, não intenção.
    expect(adapter.parse('31/02/1990')).toBeNull();
    expect(adapter.parse('32/01/1990')).toBeNull();
    expect(adapter.parse('23/13/1990')).toBeNull();
  });

  it('vazio é vazio, não data inválida', () => {
    expect(adapter.parse('')).toBeNull();
    expect(adapter.parse('   ')).toBeNull();
  });

  it('escreve de volta no formato que a pessoa digitou', () => {
    expect(adapter.format(new Date(1988, 6, 23), 'input')).toBe('23/07/1988');
    expect(adapter.format(new Date(1990, 0, 5), 'input')).toBe('05/01/1990');
  });
});

describe('paraIso', () => {
  it('nulo vira vazio, que é o que o campo guarda sem data', () => {
    expect(paraIso(null)).toBe('');
  });

  it('usa os componentes locais da data', () => {
    expect(paraIso(new Date(2000, 11, 31))).toBe('2000-12-31');
  });
});

describe('BrDateAdapter no meio da digitação', () => {
  const adapter = TestBed.inject(BrDateAdapter);

  /**
   * O defeito que isto fecha: `Date.parse` responde alguma coisa para quase
   * tudo, e o campo escrevia de volta o palpite. Digitar "2" virava
   * "01/02/2001" na tela, e a tecla seguinte caía em cima disso.
   */
  it('data pela metade é "ainda não sei", não um palpite', () => {
    for (const parcial of ['2', '23', '23/', '23/0', '23/07', '23/07/', '23/07/19', '2307']) {
      expect(adapter.parse(parcial), `"${parcial}" não é uma data`).toBeNull();
    }
  });

  it('e texto que não é data nenhuma também não vira data', () => {
    expect(adapter.parse('ontem')).toBeNull();
    expect(adapter.parse('23 de julho')).toBeNull();
    expect(adapter.parse('--')).toBeNull();
  });

  it('a data inteira continua sendo lida, com ou sem separador', () => {
    expect(paraIso(adapter.parse('23/07/1988'))).toBe('1988-07-23');
    expect(paraIso(adapter.parse('23071988'))).toBe('1988-07-23');
    expect(paraIso(adapter.parse('23 07 1988'))).toBe('1988-07-23');
  });
});
