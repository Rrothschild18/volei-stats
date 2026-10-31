import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { IndexedDbService } from '../database/indexed-db.service';
import { InMemoryDbService } from './in-memory-db.service';
import { buildMockData, GROUP_SEGUNDA, MOCK_USER_PLAYER_ID } from './mock-seed';
import { AppFacade } from '../facade/app.facade';
import { DrawService } from '../services/draw.service';
import { TournamentService } from '../services/tournament.service';
import { Player } from '../../shared/models';

/**
 * O cenário mockado é o das telas do handoff. Se ele deixar de bater, as telas
 * param de mostrar o que foi desenhado — então vale travar aqui.
 */
describe('cenário de exemplo do redesign', () => {
  let facade: AppFacade;
  let tournaments: TournamentService;
  let draws: DrawService;
  let players: Map<string, Player>;

  beforeEach(async () => {
    // Cada teste parte do cenário limpo, sem o estado guardado pelo anterior.
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [InMemoryDbService, { provide: IndexedDbService, useExisting: InMemoryDbService }],
    });

    TestBed.inject(InMemoryDbService).load(buildMockData(), 'spec');
    facade = TestBed.inject(AppFacade);
    tournaments = TestBed.inject(TournamentService);
    draws = TestBed.inject(DrawService);
    players = new Map((await facade.getPlayers()).map((player) => [player.id, player]));
  });

  function label(playerIds: readonly string[]): string {
    return playerIds.map((id) => players.get(id)?.name ?? '?').join(' + ');
  }

  it('o usuário é jogador no Vôlei Segunda e admin no Vôlei Trabalho', async () => {
    const memberships = await facade.getMembershipsByPlayerId(MOCK_USER_PLAYER_ID);
    const roles = new Map(memberships.map((member) => [member.groupId, member.role]));

    expect(roles.get(GROUP_SEGUNDA)).toBe('player');
    expect(roles.get('g-trabalho')).toBe('admin');
  });

  it('a sessão de hoje tem 11 presentes e dois campeonatos', async () => {
    const session = await facade.getTodaySession(GROUP_SEGUNDA);

    expect(session).toBeDefined();
    expect(session!.playerIds).toHaveLength(11);

    const todayTournaments = await facade.getTournamentsBySessionId(session!.id);
    expect(todayTournaments.map((tournament) => tournament.name)).toEqual([
      'Saca ni mim Douglas',
      'Tira o par o ímpar aí',
    ]);
  });

  it('o campeonato 2 está na semifinal do bye, com o encaixe em quadra', async () => {
    const tournament = (await facade.getTournamentById('tn-camp-2'))!;
    const pending = await tournaments.getNextMatches(tournament);

    expect(pending).toHaveLength(1);
    expect(pending[0].phase).toBe('semifinal-bye');

    const teamA = tournament.teams.find((team) => team.id === pending[0].teamAId)!;
    const teamB = tournament.teams.find((team) => team.id === pending[0].teamBId)!;

    expect(label(teamA.playerIds)).toBe('Rafa + Malu');
    expect(label(teamB.playerIds)).toBe('Duda + Caio');
  });

  it('a classificação do campeonato 1 é a do handoff, sem a dupla desfeita', async () => {
    const tournament = (await facade.getTournamentById('tn-camp-1'))!;
    const matches = await facade.getMatchesByTournamentId('tn-camp-1');

    const standings = tournaments.computeFinalStandings(tournament, matches);
    const names = standings.map((standing) =>
      label(tournament.teams.find((team) => team.id === standing.teamId)!.playerIds),
    );

    expect(names).toEqual([
      'Rafa + Bia',
      'Duda + Malu',
      'Léo + Caio',
      'Gui + Paty',
      'Thiago + Nina',
    ]);
    // Léo + Carol foi desfeita no encaixe: vira nota de rodapé, não posição.
    expect(names).not.toContain('Léo + Carol');
  });

  it('duas pessoas já esperaram hoje, e a espera do próximo sorteio sai das outras nove', async () => {
    const session = (await facade.getTodaySession(GROUP_SEGUNDA))!;
    const counts = await draws.getWaitCountsInSession(session.id);

    expect(counts.get('p-caio')).toBe(1);
    expect(counts.get('p-malu')).toBe(1);
    expect([...counts.values()].reduce((total, value) => total + value, 0)).toBe(2);

    const present = session.playerIds.map((id) => players.get(id)!);
    const candidates = await draws.waitingCandidatesForSession(session.id, present, []);

    expect(candidates).toHaveLength(9);
    expect(candidates).not.toContain('p-caio');
    expect(candidates).not.toContain('p-malu');
  });

  it('as prioridades do próximo sorteio vêm do último campeonato concluído', async () => {
    const session = (await facade.getTodaySession(GROUP_SEGUNDA))!;
    const entries = await draws.getPriorityEntries(session.id);

    expect(entries).toEqual([
      { playerId: 'p-thiago', reason: 'direct-elimination' },
      { playerId: 'p-nina', reason: 'direct-elimination' },
      { playerId: 'p-carol', reason: 'coin-flip-loss' },
    ]);
  });

  it('o histórico tem volume para os rankings', async () => {
    const sessions = await facade.getSessionsByGroupId(GROUP_SEGUNDA);
    const matches = await facade.getMatches();
    const stats = await facade.getAllPlayerStats();

    expect(sessions.length).toBeGreaterThan(20);
    expect(matches.length).toBeGreaterThan(80);
    expect(stats.length).toBeGreaterThan(10);
    expect(stats.every((entry) => entry.gamesPlayed > 0)).toBe(true);
  });
});
