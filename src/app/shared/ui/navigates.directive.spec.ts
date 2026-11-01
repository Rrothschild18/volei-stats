import { afterEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Event, NavigationCancel, NavigationEnd, Router } from '@angular/router';
import { NavigatesDirective } from './navigates.directive';

/**
 * O botão que abre outra tela trava no primeiro toque e espera junto com ela.
 *
 * Duas coisas acontecem em tempos diferentes de propósito: a trava é imediata,
 * porque é ela que impede o toque duplo; o anel espera 150 ms, porque a maioria
 * das navegações termina antes disso e um piscar de anel lê como defeito.
 */
@Component({
  imports: [NavigatesDirective],
  template: `<button type="button" class="btn" appNavigates (click)="toques = toques + 1">
    NOVA SESSÃO
  </button>`,
})
class HospedeiroDeTeste {
  toques = 0;
}

describe('NavigatesDirective', () => {
  afterEach(() => vi.useRealTimers());

  function setup() {
    const events = new Subject<Event>();
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { events } }],
    });
    vi.useFakeTimers();

    const fixture = TestBed.createComponent(HospedeiroDeTeste);
    fixture.detectChanges();
    const botao = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    return {
      fixture,
      events,
      botao,
      host: fixture.componentInstance,
      tocar: () => {
        botao.click();
        fixture.detectChanges();
      },
      passar: (ms: number) => {
        vi.advanceTimersByTime(ms);
        fixture.detectChanges();
      },
    };
  }

  it('começa solto', () => {
    const { botao } = setup();

    expect(botao.disabled).toBe(false);
    expect(botao.getAttribute('aria-busy')).toBeNull();
  });

  it('o primeiro toque trava o botão na hora', () => {
    const { botao, tocar } = setup();

    tocar();

    expect(botao.disabled, 'travado sem esperar o anel').toBe(true);
  });

  it('e o segundo toque não passa', () => {
    const { host, tocar } = setup();

    tocar();
    tocar();

    expect(host.toques).toBe(1);
  });

  it('o anel só aparece se a tela demorar', () => {
    const { botao, tocar, passar } = setup();

    tocar();
    passar(149);
    expect(botao.getAttribute('aria-busy'), 'antes do atraso, só travado').toBeNull();

    passar(1);
    expect(botao.getAttribute('aria-busy')).toBe('true');
  });

  it('a tela chegando solta o botão', () => {
    const { botao, events, tocar, passar } = setup();

    tocar();
    passar(200);
    events.next(new NavigationEnd(1, '/g/1/campeonatos', '/g/1/campeonatos'));
    passar(1);

    expect(botao.disabled).toBe(false);
    expect(botao.getAttribute('aria-busy')).toBeNull();
  });

  it('um guard que redireciona também solta', () => {
    const { botao, events, tocar, passar } = setup();

    tocar();
    passar(200);
    events.next(new NavigationCancel(1, '/g/1/eu', ''));
    passar(1);

    expect(botao.disabled).toBe(false);
  });

  it('toque que não levou a navegação nenhuma não trava o botão para sempre', () => {
    const { botao, tocar, passar } = setup();

    tocar();
    passar(4000);

    expect(botao.disabled).toBe(false);
    expect(botao.getAttribute('aria-busy')).toBeNull();
  });
});
