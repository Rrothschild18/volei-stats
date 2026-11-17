import { describe, expect, it } from 'vitest';
import { ralisDoPlacar, ralisParaGravar, sacadorAtual } from './serve-tracker';

const A = 'team-a';
const B = 'team-b';
const duplas = { [A]: ['rafa', 'malu'], [B]: ['duda', 'caio'] } as const;

function sacador(rallies: string[], primeiros: Record<string, string> = {}) {
  return sacadorAtual({
    firstServerTeamId: A,
    playersOfTeam: (teamId) => duplas[teamId as typeof A],
    firstServerOf: primeiros,
    rallies,
  });
}

describe('sacadorAtual', () => {
  it('antes do primeiro ponto, saca quem abriu', () => {
    expect(sacador([])).toEqual({ teamId: A, playerId: 'rafa' });
  });

  it('quem saca e faz o ponto continua sacando', () => {
    expect(sacador([A, A, A])).toEqual({ teamId: A, playerId: 'rafa' });
  });

  it('perdeu o rali, a posse passa para a outra dupla', () => {
    expect(sacador([A, B])).toEqual({ teamId: B, playerId: 'duda' });
  });

  it('quando a dupla recupera a posse, saca o OUTRO jogador', () => {
    // A saca (rafa) e perde; B saca (duda) e perde; A recupera: agora é a malu.
    expect(sacador([B, A])).toEqual({ teamId: A, playerId: 'malu' });
  });

  it('a alternância segue pela partida inteira', () => {
    // rafa perde → duda perde → malu perde → caio perde → rafa de novo.
    expect(sacador([B, A, B, A])).toEqual({ teamId: A, playerId: 'rafa' });
    expect(sacador([B, A, B])).toEqual({ teamId: B, playerId: 'caio' });
  });

  it('respeita quem a quadra disse que saca primeiro em cada dupla', () => {
    expect(sacador([], { [A]: 'malu' })).toEqual({ teamId: A, playerId: 'malu' });
    expect(sacador([B], { [B]: 'caio' })).toEqual({ teamId: B, playerId: 'caio' });
  });

  it('sem saber quem abriu sacando, não aponta ninguém', () => {
    expect(
      sacadorAtual({
        firstServerTeamId: null,
        playersOfTeam: (teamId) => duplas[teamId as typeof A],
        firstServerOf: {},
        rallies: [A],
      }),
    ).toBeNull();
  });
});

describe('ralisDoPlacar', () => {
  it('um ponto a mais vira um rali no fim da sequência', () => {
    expect(ralisDoPlacar([A], { teamId: B, antes: 0, depois: 1 })).toEqual([A, B]);
  });

  it('um ponto a menos desfaz o último rali daquela dupla', () => {
    expect(ralisDoPlacar([A, B, A], { teamId: A, antes: 2, depois: 1 })).toEqual([A, B]);
    // O toque errado não era o último: sai o mais recente daquela dupla.
    expect(ralisDoPlacar([A, B, B], { teamId: A, antes: 1, depois: 0 })).toEqual([B, B]);
  });

  it('salto de mais de um ponto quebra a sequência: não dá para saber a ordem', () => {
    expect(ralisDoPlacar([A], { teamId: A, antes: 1, depois: 5 })).toBeNull();
  });

  it('sequência já quebrada continua quebrada', () => {
    expect(ralisDoPlacar(null, { teamId: A, antes: 5, depois: 6 })).toBeNull();
  });
});

describe('ralisParaGravar', () => {
  it('vira 0 e 1 quando a contagem fecha com o placar', () => {
    expect(ralisParaGravar([A, B, A, A], { teamAId: A, scoreA: 3, scoreB: 1 })).toEqual([
      0, 1, 0, 0,
    ]);
  });

  it('sequência que não fecha com o placar não é gravada', () => {
    expect(ralisParaGravar([A, B], { teamAId: A, scoreA: 12, scoreB: 10 })).toBeNull();
  });

  it('sequência quebrada continua sem ser gravada', () => {
    expect(ralisParaGravar(null, { teamAId: A, scoreA: 1, scoreB: 0 })).toBeNull();
  });
});
