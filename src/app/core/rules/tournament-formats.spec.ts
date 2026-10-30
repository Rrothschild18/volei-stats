import { describe, expect, it } from 'vitest';
import {
  TOURNAMENT_FORMATS,
  availableFormatsForPlayerCount,
  defaultFormatForPlayerCount,
  findFormat,
  formatsForPlayerCount,
  nearestPlayableCounts,
} from './tournament-formats';

/** Formatos que o TournamentService sabe conduzir hoje (duplas => com encaixe?). */
const BRACKETS_IMPLEMENTED = new Set([
  '2:false',
  '3:false',
  '4:false',
  '5:false',
  '6:false',
  '7:false',
  '3:true',
  '4:true',
  '5:true',
]);

describe('catálogo de formatos', () => {
  it('não tem ids repetidos', () => {
    const ids = TOURNAMENT_FORMATS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('calcula o número de pessoas a partir das duplas e do avulso', () => {
    for (const format of TOURNAMENT_FORMATS) {
      const expected = format.teamCount * 2 + (format.usesWaitingPlayer ? 1 : 0);
      expect(format.playerCount).toBe(expected);
    }
  });

  it('só marca como jogável o formato que o chaveamento realmente conduz', () => {
    // Trava contra o defeito §7.8: oferecer um formato que cria o campeonato
    // e depois não gera nenhuma partida.
    for (const format of TOURNAMENT_FORMATS) {
      if (format.status !== 'available') continue;
      const key = `${format.teamCount}:${format.usesWaitingPlayer}`;
      expect(BRACKETS_IMPLEMENTED.has(key), `${format.id} não tem chaveamento`).toBe(true);
    }
  });

  it('só usa avulso em número ímpar de pessoas', () => {
    for (const format of TOURNAMENT_FORMATS) {
      expect(format.playerCount % 2 === 1).toBe(format.usesWaitingPlayer);
    }
  });

  it('não marca 3º lugar por padrão em formato que não comporta', () => {
    for (const format of TOURNAMENT_FORMATS) {
      if (format.thirdPlace === 'never') {
        expect(format.thirdPlaceDefault).toBe(false);
      }
    }
  });

  it('nunca promete mais jogos por dupla do que o total de partidas', () => {
    for (const format of TOURNAMENT_FORMATS) {
      expect(format.minGamesPerTeam).toBeLessThanOrEqual(format.matchCount);
      expect(format.minGamesPerTeam).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('regra do 3º lugar (REGRAS.md §9.6)', () => {
  it('vem ligado com 4 duplas, para todos jogarem duas vezes', () => {
    const format = findFormat('knockout-4')!;
    expect(format.thirdPlaceDefault).toBe(true);
    expect(format.minGamesPerTeam).toBe(2);
  });

  it('vem desligado em número ímpar de duplas', () => {
    for (const id of ['knockout-5', 'knockout-7', 'encaixe-5']) {
      expect(findFormat(id)!.thirdPlaceDefault, id).toBe(false);
    }
  });

  it('nem aparece com 4 duplas + encaixe', () => {
    expect(findFormat('encaixe-4')!.thirdPlace).toBe('never');
  });
});

describe('escolha de formato por número de pessoas', () => {
  it('oferece as duas opções de 12 pessoas, incluindo a de dois grupos', () => {
    const ids = formatsForPlayerCount(12).map((f) => f.id);
    expect(ids).toContain('knockout-6');
    expect(ids).toContain('groups-2x3');
  });

  it('não oferece o formato de grupos como jogável enquanto não existir', () => {
    const ids = availableFormatsForPlayerCount(12).map((f) => f.id);
    expect(ids).toContain('knockout-6');
    expect(ids).not.toContain('groups-2x3');
  });

  it('oferece o encaixe quando o número é ímpar', () => {
    const ids = availableFormatsForPlayerCount(9).map((f) => f.id);
    expect(ids).toEqual(['encaixe-4']);
  });

  it('prefere o formato em que todo mundo joga mais vezes', () => {
    expect(defaultFormatForPlayerCount(8)!.id).toBe('knockout-4');
  });

  it('lista os jogáveis antes dos planejados', () => {
    const statuses = formatsForPlayerCount(12).map((f) => f.status);
    expect(statuses.indexOf('available')).toBeLessThan(statuses.indexOf('planned'));
  });

  it('não encontra formato para números que o catálogo não cobre', () => {
    for (const count of [1, 2, 3, 5, 17]) {
      expect(availableFormatsForPlayerCount(count), String(count)).toEqual([]);
    }
  });

  it('sugere números próximos que dariam um campeonato', () => {
    // 17 pessoas não monta nada; com uma a menos, monta o mata-mata de oito.
    expect(nearestPlayableCounts(5)).toContain(4);
    expect(nearestPlayableCounts(5)).toContain(6);
  });

  it('não sugere nada quando já existe formato para o número atual', () => {
    expect(nearestPlayableCounts(8)).not.toContain(8);
  });
});
