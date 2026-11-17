import { describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TeamOrderSheetComponent } from './team-order-sheet.component';
import { LiveTournamentStore } from '../../../core/stores/live-tournament.store';
import { TeamOrderSlot } from '../../../core/services/tournament.service';
import { Match, TournamentTeam } from '../../../shared/models';

/**
 * A folha que remonta os confrontos (ticket 44).
 *
 * O que ela precisa provar é o que a pessoa vê ANTES de gravar: quem está
 * travada não oferece botão, a prévia mostra o confronto novo, e o que sai
 * daqui é a ordem inteira — uma lista de ids, que o serviço confere de novo.
 */
function team(id: string): TournamentTeam {
  return {
    id,
    playerIds: [`${id}-a`, `${id}-b`],
    eliminated: false,
    eliminatedDirectly: false,
    synthetic: false,
    originalPlayerIds: null,
  };
}

function round1(teamAId: string, teamBId: string): Match {
  return {
    id: `${teamAId}-${teamBId}`,
    tournamentId: 't',
    sessionId: 's',
    phase: 'round-1',
    teamAId,
    teamBId,
    scoreA: 12,
    scoreB: 9,
    winnerId: teamAId,
    loserId: teamBId,
    pointDifference: 3,
    playedAt: '2026-10-26T22:12:00.000Z',
    reportedBy: null,
    correctedBy: null,
    correctedAt: null,
    coinWinnerTeamId: null,
    coinCallerPlayerId: null,
    coinChoice: null,
    teamASide: null,
    firstServerTeamId: null,
    createdAt: '2026-10-26T22:12:00.000Z',
  };
}

describe('TeamOrderSheetComponent', () => {
  function setup(travadas: readonly string[] = [], matches: readonly Match[] = []) {
    const ids = ['t1', 't2', 't3', 't4'];
    const order = signal<readonly TeamOrderSlot[]>(
      ids.map((id) => ({ team: team(id), locked: travadas.includes(id), opponentId: null })),
    );

    const store = {
      teamOrder: order,
      matches: signal<readonly Match[]>(matches),
      teamLabel: (teamId: string) => teamId.toUpperCase(),
      // No lugar da chave de verdade: quatro duplas em knockout-4 são duas
      // semifinais, casadas dois a dois na ordem dada.
      previewInitialPairs: (teamIds: readonly string[]) =>
        teamIds
          .filter((_, index) => index % 2 === 0)
          .map((teamAId, par) => ({
            phase: 'semifinal' as const,
            teamAId,
            teamBId: teamIds[par * 2 + 1],
          })),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: LiveTournamentStore, useValue: store }],
    });

    const fixture: ComponentFixture<TeamOrderSheetComponent> =
      TestBed.createComponent(TeamOrderSheetComponent);
    fixture.detectChanges();

    const botao = (label: string) =>
      fixture.nativeElement.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;

    const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

    return { fixture, botao, texto };
  }

  it('mostra os confrontos que a ordem de agora produz', () => {
    const { texto } = setup();

    expect(texto()).toContain('T1 × T2');
    expect(texto()).toContain('T3 × T4');
  });

  it('subir uma dupla muda a prévia, e marca o confronto novo', () => {
    const { fixture, botao, texto } = setup();

    botao('Subir T3').click();
    fixture.detectChanges();

    expect(texto()).toContain('T1 × T3');
    expect(texto()).toContain('T2 × T4');
    expect(texto()).toContain('novo');
  });

  it('a dupla que já jogou não tem como se mover', () => {
    const { botao } = setup(['t1', 't2'], [round1('t1', 't2')]);

    expect(botao('Descer T2').disabled).toBe(true);
    expect(botao('Subir T2').disabled).toBe(true);
    // Nem a vizinha passa por cima dela.
    expect(botao('Subir T3').disabled).toBe(true);
  });

  it('diz quantas duplas estão travadas, e por quê', () => {
    const { texto } = setup(['t1', 't2'], [round1('t1', 't2')]);

    expect(texto()).toContain('2 duplas');
    expect(texto()).toContain('já jogou e não sai do lugar');
  });

  it('marca o confronto que já foi jogado', () => {
    const { texto } = setup(['t1', 't2'], [round1('t1', 't2')]);

    expect(texto()).toContain('já jogado');
  });

  it('salvar emite a ordem inteira, e só depois de alguma mudança', () => {
    const { fixture, botao } = setup();
    const emitidas: string[][] = [];
    fixture.componentInstance.apply.subscribe((ids: string[]) => emitidas.push(ids));

    const salvar = [...fixture.nativeElement.querySelectorAll('button')].find(
      (candidate: HTMLButtonElement) => candidate.textContent?.includes('SALVAR ORDEM'),
    ) as HTMLButtonElement;

    expect(salvar.disabled).toBe(true);

    botao('Subir T3').click();
    fixture.detectChanges();
    salvar.click();

    expect(emitidas).toEqual([['t1', 't3', 't2', 't4']]);
  });
});
