import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CurrentGroupStore } from './current-group.store';
import { AppFacade } from '../facade/app.facade';
import { IdentityService, MyGroup } from '../identity';
import { Group, Player } from '../../shared/models';
import { Gender } from '../../shared/enums';

/**
 * O que o papel decide, agora que o jogo é de todos (ticket 22).
 *
 * Duas perguntas diferentes, que antes eram a mesma:
 *   canPlay  — já disse quem é? então marca presença, sorteia, lança placar
 *   isOwner  — criou o vôlei? então cadastra gente e apaga coisa
 *
 * Ser dono não é comparação feita na tela: vem de `my_groups`, que é o banco
 * respondendo. O teste entrega a resposta do mesmo jeito que o banco entrega.
 */
function player(id: string, name: string): Player {
  return {
    id,
    groupId: 'g-1',
    name,
    gender: Gender.MALE,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const RAFA = player('p-rafa', 'Rafa');
const CAIO = player('p-caio', 'Caio');

const GROUP: Group = {
  id: 'g-1',
  name: 'Vôlei Segunda',
  ownerPlayerId: RAFA.id,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const DONO: MyGroup = {
  groupId: GROUP.id,
  name: GROUP.name,
  role: 'player',
  playerId: RAFA.id,
  isOwner: true,
  todaySessionId: null,
  playerCount: 2,
  lastSessionDate: null,
};
const JOGADOR: MyGroup = { ...DONO, playerId: CAIO.id, isOwner: false };
/** Abriu o link e ainda não disse quem é: não tem jogador nenhum. */
const VISITANTE: MyGroup = { ...DONO, role: 'viewer', playerId: null, isOwner: false };

function setup(membership: MyGroup | null): {
  store: CurrentGroupStore;
  become: (next: MyGroup | null) => void;
} {
  let current = membership;

  const facade = {
    getGroupById: async (id: string) => (id === GROUP.id ? GROUP : undefined),
    getPlayersByGroupId: async () => [RAFA, CAIO],
  } as unknown as AppFacade;

  const identity: IdentityService = {
    myGroups: async () => (current ? [current] : []),
    myGroup: async (groupId: string) => (current && current.groupId === groupId ? current : null),
    forget: async () => undefined,
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: AppFacade, useValue: facade },
      { provide: IdentityService, useValue: identity },
    ],
  });

  return {
    store: TestBed.inject(CurrentGroupStore),
    become: (next) => {
      current = next;
    },
  };
}

describe('CurrentGroupStore', () => {
  it('o dono joga e manda', async () => {
    const { store } = setup(DONO);

    expect(await store.enter(GROUP.id)).toBe(true);
    expect(store.isOwner()).toBe(true);
    expect(store.canPlay()).toBe(true);
  });

  it('o jogador joga, mas não manda', async () => {
    const { store } = setup(JOGADOR);

    expect(await store.enter(GROUP.id)).toBe(true);
    expect(store.canPlay()).toBe(true);
    expect(store.isOwner()).toBe(false);
  });

  it('quem só abriu o link não joga, e não é ninguém ainda', async () => {
    const { store } = setup(VISITANTE);

    expect(await store.enter(GROUP.id)).toBe(true);
    expect(store.canPlay()).toBe(false);
    expect(store.isOwner()).toBe(false);
    expect(store.playerId()).toBeNull();
  });

  it('quem não é membro não entra', async () => {
    const { store } = setup(null);

    expect(await store.enter(GROUP.id)).toBe(false);
    expect(store.group()).toBeNull();
  });

  it('o nome do dono fica disponível para os textos da tela', async () => {
    const { store } = setup(JOGADOR);
    await store.enter(GROUP.id);

    expect(store.ownerName()).toBe('Rafa');
  });

  it('trocar de pessoa refaz o papel, sem herdar o anterior', async () => {
    const { store, become } = setup(DONO);
    await store.enter(GROUP.id);
    expect(store.isOwner()).toBe(true);

    become(JOGADOR);
    expect(await store.enter(GROUP.id)).toBe(true);

    expect(store.isOwner()).toBe(false);
    expect(store.canPlay()).toBe(true);
  });

  it('virar visitante no mesmo vôlei não deixa o jogador anterior para trás', async () => {
    const { store, become } = setup(JOGADOR);
    await store.enter(GROUP.id);
    expect(store.playerId()).toBe(CAIO.id);

    become(VISITANTE);
    expect(await store.enter(GROUP.id)).toBe(true);

    expect(store.playerId()).toBeNull();
    expect(store.canPlay()).toBe(false);
  });
});
