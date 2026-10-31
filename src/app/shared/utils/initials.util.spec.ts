import { describe, expect, it } from 'vitest';
import { siglas } from './initials.util';

/**
 * O caso que motivou isto: três pessoas cujo nome começa com R.
 */
describe('siglas', () => {
  it('uma letra basta quando ninguém mais começa com ela', () => {
    expect(siglas(['Raul', 'Bia', 'Caio'])).toEqual(
      new Map([
        ['Raul', 'R'],
        ['Bia', 'B'],
        ['Caio', 'C'],
      ]),
    );
  });

  it('Raul, Raphael e Rafael deixam de ser três círculos "R"', () => {
    const resultado = siglas(['Raul', 'Raphael', 'Rafael']);

    expect(resultado.get('Raul')).toBe('RAU');
    expect(resultado.get('Raphael')).toBe('RAP');
    expect(resultado.get('Rafael')).toBe('RAF');
  });

  it('cresce só o necessário: quem não empata fica com uma letra', () => {
    const resultado = siglas(['Rafael', 'Rapha', 'Bia']);

    expect(resultado.get('Bia')).toBe('B');
    expect(resultado.get('Rafael')).toBe('RAF');
    expect(resultado.get('Rapha')).toBe('RAP');
  });

  it('duas letras resolvem quando a terceira não é necessária', () => {
    const resultado = siglas(['Bia', 'Be']);

    expect(resultado.get('Bia')).toBe('BI');
    expect(resultado.get('Be')).toBe('BE');
  });

  it('acento não cria diferença onde não há: Vitória e Vivi empatam em V e VI', () => {
    const resultado = siglas(['Vitória', 'Vivi']);

    expect(resultado.get('Vitória')).toBe('VIT');
    expect(resultado.get('Vivi')).toBe('VIV');
  });

  it('o acento aparece na sigla quando cai dentro dela', () => {
    expect(siglas(['Ângela', 'Antônio']).get('Ângela')).toBe('ÂNG');
  });

  it('cinco letras separam os pares que de fato aparecem num vôlei', () => {
    const resultado = siglas(['Pedro', 'Pedrinho', 'Will', 'Willy', 'Paty']);

    // Três letras não bastavam: os dois pares davam PED e WIL.
    expect(resultado.get('Pedro')).toBe('PEDRO');
    expect(resultado.get('Pedrinho')).toBe('PEDRI');
    expect(resultado.get('Will')).toBe('WILL');
    expect(resultado.get('Willy')).toBe('WILLY');
    // E quem não empata continua curto.
    expect(resultado.get('Paty')).toBe('PA');
  });

  it('quem empata até a quinta fica igual, e o nome ao lado resolve', () => {
    const resultado = siglas(['Ana Paula', 'Ana Clara']);

    expect(resultado.get('Ana Paula')).toBe('ANA P');
    expect(resultado.get('Ana Clara')).toBe('ANA C');
  });

  it('um nome mais curto que a sigla não inventa letras', () => {
    const resultado = siglas(['Bo', 'Bob']);

    expect(resultado.get('Bo')).toBe('BO');
    expect(resultado.get('Bob')).toBe('BOB');
  });

  it('um nome só fica com uma letra', () => {
    expect(siglas(['Raul'])).toEqual(new Map([['Raul', 'R']]));
  });
});
