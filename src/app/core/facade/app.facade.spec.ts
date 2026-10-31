import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AppFacade } from './app.facade';
import { InMemoryDbService } from '../mock/in-memory-db.service';
import { provideDemoData } from '../mock/mock-data.providers';
import { buildMockData, GROUP_TRABALHO } from '../mock/mock-seed';

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
    TestBed.inject(InMemoryDbService).load(buildMockData(), 'spec');
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
