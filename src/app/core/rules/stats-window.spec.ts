import { describe, expect, it } from 'vitest';
import { lastSessionIds, noitesComCampeonato, sumPlayerStats, sumTeamStats } from './stats-window';
import { PlayerSessionStats, Session, TeamSessionStats } from '../../shared/models';

function session(id: string, date: string, tournamentIds: string[] = ['t1']): Session {
  return { id, date, tournamentIds } as unknown as Session;
}

describe('noitesComCampeonato', () => {
  it('deixa de fora a noite que só tem presença marcada', () => {
    const sessions = [
      session('s1', '2026-11-09'),
      // Hoje: a presença já foi salva, mas ninguém sorteou nada ainda.
      session('s2', '2026-11-16', []),
    ];

    expect(noitesComCampeonato(sessions).map((s) => s.id)).toEqual(['s1']);
  });
});

describe('lastSessionIds', () => {
  it('pega as N noites mais recentes pela data, não pela ordem da lista', () => {
    const sessions = [
      session('s1', '2026-10-26'),
      session('s5', '2026-11-16'),
      session('s3', '2026-11-09'),
      session('s2', '2026-11-02'),
      session('s4', '2026-11-10'),
    ];

    expect([...lastSessionIds(sessions, 4)].sort()).toEqual(['s2', 's3', 's4', 's5']);
  });

  it('com menos noites do que a janela, a janela é o que existe', () => {
    const sessions = [session('s1', '2026-11-09'), session('s2', '2026-11-16')];

    expect([...lastSessionIds(sessions, 4)].sort()).toEqual(['s1', 's2']);
  });

  it('vôlei sem nenhuma sessão devolve janela vazia', () => {
    expect([...lastSessionIds([], 4)]).toEqual([]);
  });
});

function linha(
  sessionId: string,
  playerId: string,
  wins: number,
  gamesPlayed: number,
  timesWaited = 0,
): PlayerSessionStats {
  return { sessionId, playerId, wins, gamesPlayed, losses: gamesPlayed - wins, timesWaited };
}

describe('sumPlayerStats', () => {
  it('soma as noites da janela e recalcula o aproveitamento no total', () => {
    // Douglas, no vôlei real: 4 em 5 numa noite, 8 em 12 na outra = 12 em 17.
    const linhas = [linha('s1', 'douglas', 4, 5), linha('s2', 'douglas', 8, 12)];

    expect(sumPlayerStats(linhas, new Set(['s1', 's2']))).toEqual([
      {
        playerId: 'douglas',
        gamesPlayed: 17,
        wins: 12,
        losses: 5,
        timesWaited: 0,
        winPercentage: 71,
      },
    ]);
  });

  it('ignora a noite que ficou fora da janela', () => {
    const linhas = [linha('s0', 'raul', 5, 5), linha('s1', 'raul', 1, 9)];

    expect(sumPlayerStats(linhas, new Set(['s1']))).toEqual([
      { playerId: 'raul', gamesPlayed: 9, wins: 1, losses: 8, timesWaited: 0, winPercentage: 11 },
    ]);
  });

  it('soma as esperas junto, e quem só esperou aparece com zero jogo', () => {
    const linhas = [linha('s1', 'be', 0, 0, 1), linha('s2', 'be', 0, 0, 2)];

    expect(sumPlayerStats(linhas, new Set(['s1', 's2']))).toEqual([
      { playerId: 'be', gamesPlayed: 0, wins: 0, losses: 0, timesWaited: 3, winPercentage: 0 },
    ]);
  });

  it('janela nula é o histórico inteiro', () => {
    const linhas = [linha('s0', 'kaio', 3, 6), linha('s9', 'kaio', 4, 7)];

    expect(sumPlayerStats(linhas, null)[0].gamesPlayed).toBe(13);
  });
});

function duplaDaNoite(
  sessionId: string,
  playerIds: [string, string],
  wins: number,
  gamesPlayed: number,
): TeamSessionStats {
  return { sessionId, playerIds, wins, gamesPlayed, losses: gamesPlayed - wins };
}

const nomeDe = (id: string) => ({ douglas: 'Douglas', wily: 'Wily' })[id] ?? '?';

describe('sumTeamStats', () => {
  it('a mesma dupla em noites diferentes conta no mesmo lugar', () => {
    // Douglas + Wily: 5 jogos juntos no vôlei real, em duas noites.
    const linhas = [
      duplaDaNoite('s1', ['douglas', 'wily'], 2, 3),
      duplaDaNoite('s2', ['wily', 'douglas'], 2, 2),
    ];

    expect(sumTeamStats(linhas, new Set(['s1', 's2']), nomeDe)).toEqual([
      {
        playerIds: ['douglas', 'wily'],
        playerNames: ['Douglas', 'Wily'],
        gamesPlayed: 5,
        wins: 4,
        losses: 1,
        winPercentage: 80,
      },
    ]);
  });

  it('a noite fora da janela não entra na conta da dupla', () => {
    const linhas = [
      duplaDaNoite('s0', ['douglas', 'wily'], 3, 3),
      duplaDaNoite('s1', ['douglas', 'wily'], 1, 2),
    ];

    expect(sumTeamStats(linhas, new Set(['s1']), nomeDe)[0].gamesPlayed).toBe(2);
  });
});
