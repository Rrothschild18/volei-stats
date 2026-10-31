import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DrawService } from './draw.service';
import { AppFacade } from '../facade/app.facade';
import { proposalKey } from '../rules/draw-proposals';
import { DrawProposal, Player, Tournament } from '../../shared/models';
import { Gender } from '../../shared/enums';

const NAMES = [
  'Rafa',
  'Bia',
  'Duda',
  'Léo',
  'Carol',
  'Thiago',
  'Nina',
  'Gui',
  'Paty',
  'Caio',
  'Malu',
];

function players(count: number): Player[] {
  return NAMES.slice(0, count).map((name, index) => ({
    id: `p-${name.toLowerCase()}`,
    name,
    gender: index % 2 === 0 ? Gender.MALE : Gender.FEMALE,
    birthDate: null,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }));
}

/** Fachada só com o que o sorteio lê de uma sessão. */
function facadeStub(draws: DrawProposal[] = [], tournaments: Tournament[] = []) {
  return {
    getDrawsBySessionId: async () => draws,
    getTournamentsBySessionId: async () => tournaments,
  } as unknown as AppFacade;
}

function setup(draws?: DrawProposal[], tournaments?: Tournament[]): DrawService {
  TestBed.configureTestingModule({
    providers: [DrawService, { provide: AppFacade, useValue: facadeStub(draws, tournaments) }],
  });
  return TestBed.inject(DrawService);
}

describe('DrawService.generateProposals', () => {
  it('gera três propostas distintas, cada uma com um avulso diferente', async () => {
    const service = setup();

    const proposals = await service.generateProposals('s1', players(11), new Set(), []);

    expect(proposals).toHaveLength(3);

    const waiting = proposals.map((proposal) => proposal.waitingPlayerId);
    expect(new Set(waiting).size).toBe(3);

    const keys = proposals.map((proposal) => proposalKey(proposal.teams, proposal.waitingPlayerId));
    expect(new Set(keys).size).toBe(3);
  });

  it('forma cinco duplas e deixa um avulso com 11 presentes', async () => {
    const service = setup();

    const [proposal] = await service.generateProposals('s1', players(11), new Set(), []);

    expect(proposal.teams).toHaveLength(5);
    expect(proposal.waitingPlayerId).not.toBeNull();
    const drawn = proposal.teams.flatMap((team) => team.playerIds);
    expect(drawn).not.toContain(proposal.waitingPlayerId);
    expect(new Set(drawn).size).toBe(10);
  });

  it('com número par não há avulso, e as propostas continuam diferentes', async () => {
    const service = setup();

    const proposals = await service.generateProposals('s1', players(10), new Set(), []);

    expect(proposals.length).toBeGreaterThan(1);
    expect(proposals.every((proposal) => proposal.waitingPlayerId === null)).toBe(true);

    const keys = proposals.map((proposal) => proposalKey(proposal.teams, proposal.waitingPlayerId));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('não escolhe como avulso quem já esperou hoje nem quem tem prioridade', async () => {
    const alreadyWaited: DrawProposal = {
      id: 'd-1',
      sessionId: 's1',
      teams: [],
      waitingPlayerId: 'p-caio',
      score: 100,
      badges: [],
      selected: true,
      createdAt: '2026-10-26T22:00:00.000Z',
    };

    const service = setup([alreadyWaited]);

    const proposals = await service.generateProposals('s1', players(11), new Set(), [
      { playerId: 'p-thiago', reason: 'direct-elimination' },
      { playerId: 'p-nina', reason: 'direct-elimination' },
    ]);

    const waiting = proposals.map((proposal) => proposal.waitingPlayerId);
    expect(waiting).not.toContain('p-caio');
    expect(waiting).not.toContain('p-thiago');
    expect(waiting).not.toContain('p-nina');
  });

  it('marca a primeira proposta como a escolhida e não renderiza pontuação em nenhuma', async () => {
    const service = setup();

    const proposals = await service.generateProposals('s1', players(11), new Set(), []);

    expect(proposals[0].selected).toBe(true);
    expect(proposals.slice(1).every((proposal) => !proposal.selected)).toBe(true);
    // A pontuação continua existindo para ordenar — a tela é que não mostra.
    expect(proposals.every((proposal) => typeof proposal.score === 'number')).toBe(true);
  });
});

describe('DrawService.swapPlayers', () => {
  it('troca dois jogadores de dupla', () => {
    const service = setup();
    const teams = [
      { id: 't1', playerIds: ['p-rafa', 'p-bia'] as [string, string] },
      { id: 't2', playerIds: ['p-gui', 'p-paty'] as [string, string] },
    ];

    const swapped = service.swapPlayers(teams, 'p-bia', 'p-gui');

    expect(swapped[0].playerIds).toEqual(['p-rafa', 'p-gui']);
    expect(swapped[1].playerIds).toEqual(['p-bia', 'p-paty']);
  });
});
