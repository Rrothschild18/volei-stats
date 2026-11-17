import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AppFacade } from './app.facade';
import { DemoDbService } from '../demo/demo-db.service';
import { provideDemoData } from '../demo/demo-data.providers';
import { buildDemoData, GROUP_TRABALHO } from '../demo/demo-seed';
import {
  DrawRepository,
  GroupRepository,
  MatchRepository,
  PlayerRepository,
  SessionRepository,
  TournamentRepository,
} from '../repositories';
import { Session, Tournament } from '../../shared/models';

/**
 * Um dia tem UMA sessão por vôlei, e isso é índice único no banco.
 *
 * Duas pessoas marcando a presença ao mesmo tempo na beira da quadra é o caso
 * comum, não a exceção — e antes disto a segunda levava erro de chave repetida.
 */
describe('AppFacade · a sessão do dia', () => {
  let facade: AppFacade;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideDemoData()] });
    TestBed.inject(DemoDbService).load(buildDemoData(), 'spec');
    facade = TestBed.inject(AppFacade);
  });

  it('a segunda pessoa cai na mesma sessão, e não numa nova', async () => {
    const players = await facade.getPlayersByGroupId(GROUP_TRABALHO);
    const primeira = await facade.createSession(GROUP_TRABALHO, [players[0].id, players[1].id]);
    const segunda = await facade.createSession(GROUP_TRABALHO, [players[2].id]);

    expect(segunda.id).toBe(primeira.id);
    const hoje = (await facade.getSessionsByGroupId(GROUP_TRABALHO)).filter(
      (session) => session.date === primeira.date,
    );
    expect(hoje.length).toBe(1);
  });

  it('a presença de quem chegou primeiro não é jogada fora', async () => {
    const players = await facade.getPlayersByGroupId(GROUP_TRABALHO);
    await facade.createSession(GROUP_TRABALHO, [players[0].id, players[1].id]);
    const depois = await facade.createSession(GROUP_TRABALHO, [players[1].id, players[2].id]);

    expect([...depois.playerIds].sort()).toEqual(
      [players[0].id, players[1].id, players[2].id].sort(),
    );
  });
});

/**
 * Excluir um campeonato: a ordem não é detalhe (ticket 45).
 *
 * `tournaments.draw_id` é `on delete restrict`. Apagar o sorteio enquanto o
 * campeonato aponta para ele é violação de chave estrangeira — e o excluir
 * inteiro morre ali, para o dono, que é justamente quem tem permissão de
 * excluir. Reproduzido contra o Postgres em
 * `supabase/tests/08-excluir-campeonato.sql`.
 *
 * O sorteio precisa sair, e por isso não basta parar de apagá-lo: sorteio
 * escolhido sem campeonato É sorteio pendente, e o app passaria a oferecer
 * "COMEÇAR O PRÓXIMO" com as duplas do campeonato recém-apagado.
 */
describe('AppFacade.deleteTournament', () => {
  function setup() {
    const ordem: string[] = [];

    const tournament = {
      id: 'tn',
      sessionId: 's1',
      drawId: 'd1',
    } as unknown as Tournament;

    const session = {
      id: 's1',
      tournamentIds: ['tn'],
      drawIds: ['d1'],
    } as unknown as Session;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TournamentRepository,
          useValue: {
            getById: async () => tournament,
            delete: async () => void ordem.push('campeonato'),
          },
        },
        {
          provide: DrawRepository,
          useValue: { delete: async () => void ordem.push('sorteio') },
        },
        {
          provide: MatchRepository,
          useValue: {
            getByTournamentId: async () => [{ id: 'm1' }],
            delete: async () => void ordem.push('partida'),
          },
        },
        {
          provide: SessionRepository,
          useValue: {
            getById: async () => session,
            save: async (entry: Session) => {
              ordem.push('sessão');
              return entry;
            },
          },
        },
        { provide: PlayerRepository, useValue: {} },
        { provide: GroupRepository, useValue: {} },
      ],
    });

    return { facade: TestBed.inject(AppFacade), ordem, session };
  }

  it('apaga o campeonato antes do sorteio', async () => {
    const { facade, ordem } = setup();

    await facade.deleteTournament('tn');

    expect(ordem.indexOf('campeonato')).toBeLessThan(ordem.indexOf('sorteio'));
  });

  it('o sorteio sai junto: senão ele vira o sorteio pendente do dia', async () => {
    const { facade, ordem } = setup();

    await facade.deleteTournament('tn');

    expect(ordem).toContain('sorteio');
  });

  it('e a sessão deixa de listar os dois', async () => {
    const { facade, session } = setup();

    await facade.deleteTournament('tn');

    expect(session.tournamentIds).toEqual([]);
    expect(session.drawIds).toEqual([]);
  });
});
