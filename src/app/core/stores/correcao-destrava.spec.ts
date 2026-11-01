import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LiveTournamentStore } from './live-tournament.store';
import { CurrentGroupStore } from './current-group.store';
import { AppFacade } from '../facade/app.facade';
import { DrawService } from '../services/draw.service';
import { TournamentService } from '../services/tournament.service';
import { ScoreCorrection } from '../repositories';
import { Match, MatchPhase, Tournament, TournamentTeam } from '../../shared/models';

/**
 * O fluxo que os testes não cobriam: corrigir um placar e CONTINUAR jogando.
 *
 * Os testes do ticket 35 olharam cada peça — a decisão caduca sai, as partidas
 * obsoletas saem, o encaixe é desfeito — e nenhum deles perguntou a única coisa
 * que importa depois: a chave volta a andar? Peça verde, fluxo quebrado.
 *
 * Aqui o banco é de mentira mas se comporta como o de verdade: `correctScore`
 * escreve nele, `reload` lê de volta, e a pergunta no fim é sempre a mesma —
 * dá para jogar a próxima partida?
 */

function team(id: string, playerIds: [string, string]): TournamentTeam {
  return {
    id,
    playerIds,
    eliminated: false,
    eliminatedDirectly: false,
    synthetic: false,
    originalPlayerIds: null,
  };
}

function match(
  id: string,
  phase: MatchPhase,
  teamAId: string,
  teamBId: string,
  scoreA: number,
  scoreB: number,
): Match {
  return {
    id,
    tournamentId: 't1',
    sessionId: 's1',
    phase,
    teamAId,
    teamBId,
    scoreA,
    scoreB,
    winnerId: scoreA > scoreB ? teamAId : teamBId,
    loserId: scoreA > scoreB ? teamBId : teamAId,
    pointDifference: Math.abs(scoreA - scoreB),
    playedAt: '2026-10-26T22:30:00.000Z',
    reportedBy: null,
    correctedBy: null,
    correctedAt: null,
    createdAt: '2026-10-26T22:30:00.000Z',
  };
}

function seisDuplas(): Tournament {
  return {
    id: 't1',
    name: 'Campeonato',
    sessionId: 's1',
    drawId: 'd1',
    formatId: 'knockout-6',
    teams: [
      team('t1', ['rafa', 'bia']),
      team('t2', ['thiago', 'nina']),
      team('t3', ['duda', 'malu']),
      team('t4', ['gui', 'paty']),
      team('t5', ['leo', 'carol']),
      team('t6', ['will', 'be']),
    ],
    waitingPlayerId: null,
    oddPlayerPlacementEnabled: false,
    oddPlayerLoserPriorityEnabled: false,
    oddPlayerPlacement: null,
    priorityEntries: [],
    pointLimit: 12,
    thirdPlaceEnabled: false,
    matches: [],
    status: 'in-progress',
    finalStandings: [],
    tiebreakDecisions: [],
    createdAt: '2026-10-26T22:00:00.000Z',
    updatedAt: '2026-10-26T22:00:00.000Z',
  };
}

/** Um banco de mentira que guarda de verdade: escreve, apaga e devolve. */
function bancoFalso(campeonato: Tournament, partidas: Match[]) {
  let torneio = campeonato;
  const matches = [...partidas];

  const facade = {
    getTournamentById: async () => torneio,
    getMatchesByTournamentId: async () => [...matches],
    getMatchById: async (id: string) => matches.find((m) => m.id === id),
    getPlayers: async () => [],
    saveMatch: async (entry: Match) => {
      const i = matches.findIndex((m) => m.id === entry.id);
      if (i >= 0) matches[i] = entry;
      else matches.push(entry);
      return entry;
    },
    saveTournament: async (entry: Tournament) => {
      torneio = entry;
      return entry;
    },
    correctMatchScore: async (c: ScoreCorrection) => {
      const alvo = matches.find((m) => m.id === c.matchId);
      if (!alvo) throw new Error('partida sumiu');

      const i = matches.indexOf(alvo);
      matches[i] = {
        ...alvo,
        scoreA: c.scoreA,
        scoreB: c.scoreB,
        winnerId: c.scoreA > c.scoreB ? alvo.teamAId : alvo.teamBId,
        loserId: c.scoreA > c.scoreB ? alvo.teamBId : alvo.teamAId,
        pointDifference: Math.abs(c.scoreA - c.scoreB),
      };

      for (const id of c.obsoleteMatchIds) {
        const j = matches.findIndex((m) => m.id === id);
        if (j >= 0) matches.splice(j, 1);
      }
    },
  } as unknown as AppFacade;

  return { facade, matches };
}

function montar(campeonato: Tournament, partidas: Match[]) {
  const { facade, matches } = bancoFalso(campeonato, partidas);

  TestBed.configureTestingModule({
    providers: [
      LiveTournamentStore,
      TournamentService,
      { provide: AppFacade, useValue: facade },
      { provide: DrawService, useValue: { discardPendingDraw: async () => null } },
      { provide: CurrentGroupStore, useValue: { playerId: () => 'rafa' } },
    ],
  });

  const store = TestBed.inject(LiveTournamentStore);
  return { store, matches };
}

describe('corrigir um placar e continuar o campeonato', () => {
  /**
   * Seis duplas, rodada 1 inteira, sem empate nenhum: t1 vence por 10 e vai
   * direto à final, t3 por 5, t5 por 2. A semifinal é t3 × t5.
   */
  const round1 = [
    match('m1', 'round-1', 't1', 't2', 12, 2),
    match('m2', 'round-1', 't3', 't4', 12, 7),
    match('m3', 'round-1', 't5', 't6', 12, 10),
  ];

  it('a chave anda depois da rodada 1', async () => {
    const { store } = montar(seisDuplas(), round1);
    await store.load('t1');

    expect(store.paused()).toBe(false);
    expect(store.pending().length).toBeGreaterThan(0);
  });

  it('corrigir sem mexer em quem venceu deixa a chave andando', async () => {
    const { store } = montar(seisDuplas(), round1);
    await store.load('t1');

    // t1 continua vencendo, agora por 8.
    const r = await store.correctScore('m1', 12, 4, 'rafa');

    expect(r.saved).toBe(true);
    expect(store.paused(), 'a chave não devia ter pausado').toBe(false);
    expect(store.pending().length, 'tem partida para jogar').toBeGreaterThan(0);
  });

  it('corrigir virando o vencedor: a chave segue, com o outro no lugar', async () => {
    const { store } = montar(seisDuplas(), round1);
    await store.load('t1');

    // Agora t2 vence por 10 e é ele quem vai direto à final.
    await store.correctScore('m1', 2, 12, 'rafa');

    expect(store.paused()).toBe(false);
    expect(store.pending().length).toBeGreaterThan(0);
  });

  it('correção que cria empate pausa — e registrar o par-ou-ímpar DESTRAVA', async () => {
    const { store } = montar(seisDuplas(), round1);
    await store.load('t1');

    // t1 passa a vencer por 5, empatando com t3: fronteira dos vencedores.
    await store.correctScore('m1', 12, 7, 'rafa');

    expect(store.tiebreak(), 'a chave pausou pedindo o par-ou-ímpar').not.toBeNull();
    expect(store.paused()).toBe(true);

    // Uma decisão por vez é o desenho (perdedores primeiro, depois vencedores):
    // o que NÃO pode é a fila nunca acabar.
    const decididos: string[] = [];
    for (let volta = 0; volta < 6 && store.tiebreak(); volta += 1) {
      const empate = store.tiebreak()!;
      decididos.push(`${empate.kind}:${empate.teamIds.join('+')}`);
      await store.resolveTiebreak(empate.teamIds[0]);
    }

    expect(store.tiebreak(), `a fila não acabou: ${decididos.join(' | ')}`).toBeNull();
    expect(store.paused(), 'a chave tinha de voltar a andar').toBe(false);
    expect(store.pending().length, 'e ter partida para jogar').toBeGreaterThan(0);
  });

  it('e dá para corrigir DE NOVO depois de a chave ter destravado', async () => {
    const { store } = montar(seisDuplas(), round1);
    await store.load('t1');

    await store.correctScore('m1', 12, 7, 'rafa');
    for (let volta = 0; volta < 6 && store.tiebreak(); volta += 1) {
      await store.resolveTiebreak(store.tiebreak()!.teamIds[0]);
    }

    // Volta ao placar original: o empate deixa de existir.
    await store.correctScore('m1', 12, 2, 'rafa');

    expect(store.tiebreak()).toBeNull();
    expect(store.paused()).toBe(false);
    expect(store.pending().length).toBeGreaterThan(0);
  });

  it('com a semifinal já jogada, corrigir a rodada 1 refaz o que vem depois', async () => {
    const comSemi = [...round1, match('m4', 'semifinal', 't3', 't5', 12, 8)];
    const { store, matches } = montar(seisDuplas(), comSemi);
    await store.load('t1');

    // t2 passa a vencer: quem vai direto à final muda, e a semifinal t3 × t5
    // continua valendo (ela não dependia de t1).
    await store.correctScore('m1', 2, 12, 'rafa');

    expect(store.paused()).toBe(false);
    expect(store.pending().length, 'a final tem de estar disponível').toBeGreaterThan(0);
    expect(
      matches.some((m) => m.id === 'm4'),
      'a semifinal continua',
    ).toBe(true);
  });
});
