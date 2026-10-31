import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CurrentGroupStore } from './current-group.store';
import { AppFacade } from '../facade/app.facade';
import { MockIdentityService } from '../mock/mock-identity.service';
import { Group, GroupMember, Player } from '../../shared/models';
import { Gender } from '../../shared/enums';

/**
 * O que o papel decide, agora que o jogo é de todos (ticket 22).
 *
 * Duas perguntas diferentes, que antes eram a mesma:
 *   canPlay  — já disse quem é? então marca presença, sorteia, lança placar
 *   isOwner  — criou o vôlei? então cadastra gente e apaga coisa
 */
function player(id: string, name: string): Player {
  return {
    id,
    name,
    gender: Gender.MALE,
    birthDate: '1990-01-01',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const RAFA = player('p-rafa', 'Rafa');
const CAIO = player('p-caio', 'Caio');
const VISITA = player('p-visita', 'Visita');

const GROUP: Group = {
  id: 'g-1',
  name: 'Vôlei Segunda',
  ownerPlayerId: RAFA.id,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const MEMBERS: GroupMember[] = [
  { id: 'm-1', groupId: GROUP.id, playerId: RAFA.id, role: 'player' },
  { id: 'm-2', groupId: GROUP.id, playerId: CAIO.id, role: 'player' },
  { id: 'm-3', groupId: GROUP.id, playerId: VISITA.id, role: 'viewer' },
];

function setup(playerId: string): { store: CurrentGroupStore; identity: MockIdentityService } {
  const facade = {
    getGroupById: async (id: string) => (id === GROUP.id ? GROUP : undefined),
    getGroupMembers: async () => MEMBERS,
    getPlayers: async () => [RAFA, CAIO, VISITA],
  } as unknown as AppFacade;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: AppFacade, useValue: facade }],
  });

  // Quem está usando o app é o mesmo serviço de identidade que a UI usa: o
  // teste troca de pessoa como a tela troca.
  const identity = TestBed.inject(MockIdentityService);
  identity.setPlayerId(playerId);

  return { store: TestBed.inject(CurrentGroupStore), identity };
}

describe('CurrentGroupStore', () => {
  it('o dono joga e manda', async () => {
    const { store } = setup(RAFA.id);

    expect(await store.enter(GROUP.id)).toBe(true);
    expect(store.isOwner()).toBe(true);
    expect(store.canPlay()).toBe(true);
  });

  it('o jogador joga, mas não manda', async () => {
    const { store } = setup(CAIO.id);

    expect(await store.enter(GROUP.id)).toBe(true);
    expect(store.canPlay()).toBe(true);
    expect(store.isOwner()).toBe(false);
  });

  it('quem só abriu o link não joga', async () => {
    const { store } = setup(VISITA.id);

    expect(await store.enter(GROUP.id)).toBe(true);
    expect(store.canPlay()).toBe(false);
    expect(store.isOwner()).toBe(false);
  });

  it('quem não é membro não entra', async () => {
    const { store } = setup('p-estranho');

    expect(await store.enter(GROUP.id)).toBe(false);
    expect(store.group()).toBeNull();
  });

  it('o nome do dono fica disponível para os textos da tela', async () => {
    const { store } = setup(CAIO.id);
    await store.enter(GROUP.id);

    expect(store.ownerName()).toBe('Rafa');
  });

  it('trocar de pessoa refaz o papel, sem herdar o anterior', async () => {
    const { store, identity } = setup(RAFA.id);
    await store.enter(GROUP.id);
    expect(store.isOwner()).toBe(true);

    identity.setPlayerId(CAIO.id);
    expect(await store.enter(GROUP.id)).toBe(true);

    expect(store.isOwner()).toBe(false);
    expect(store.canPlay()).toBe(true);
  });
});
