import { afterEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { Event, NavigationCancel, NavigationEnd, NavigationStart, Router } from '@angular/router';
import { App } from './app';

/**
 * A regra que este arquivo protege: o esqueleto de rota é SÓ da primeira tela.
 *
 * Da segunda navegação em diante já existe tela montada, e o Angular a mantém
 * no lugar enquanto o guard da próxima responde. Trocá-la por um esqueleto
 * desmontaria o que está funcionando — inclusive a barra de abas, que vive
 * acima do outlet das abas, e que é justamente quem avisa que a aba está
 * abrindo.
 */
describe('App', () => {
  afterEach(() => vi.useRealTimers());

  function setup() {
    const events = new Subject<Event>();
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { events } }],
    });

    vi.useFakeTimers();

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    return {
      fixture,
      events,
      /** O esqueleto está na tela? */
      esqueleto: () => !!fixture.nativeElement.querySelector('app-skeleton'),
      passar: (ms: number) => {
        vi.advanceTimersByTime(ms);
        fixture.detectChanges();
      },
    };
  }

  function fim(url: string): NavigationEnd {
    return new NavigationEnd(1, url, url);
  }

  it('não mostra nada antes de qualquer navegação', () => {
    expect(setup().esqueleto()).toBe(false);
  });

  it('a primeira navegação demorada vira esqueleto', () => {
    const { events, esqueleto, passar } = setup();

    events.next(new NavigationStart(1, '/voleis'));
    passar(149);
    expect(esqueleto(), 'antes do atraso ainda não').toBe(false);

    passar(1);
    expect(esqueleto()).toBe(true);
  });

  it('e a navegação rápida não chega a piscar', () => {
    const { events, esqueleto, passar } = setup();

    events.next(new NavigationStart(1, '/voleis'));
    passar(100);
    events.next(fim('/voleis'));
    passar(500);

    expect(esqueleto()).toBe(false);
  });

  it('um guard que redireciona não deixa o esqueleto preso', () => {
    const { events, esqueleto, passar } = setup();

    // `/` → `/voleis` → o guard manda para `/entrar`: cancela e começa outra.
    events.next(new NavigationStart(1, '/voleis'));
    passar(200);
    expect(esqueleto()).toBe(true);

    events.next(new NavigationCancel(1, '/voleis', ''));
    events.next(new NavigationStart(2, '/entrar'));
    passar(200);
    expect(esqueleto(), 'segue "abrindo" enquanto nenhuma tela chegou').toBe(true);

    events.next(fim('/entrar'));
    passar(1);
    expect(esqueleto()).toBe(false);
  });

  it('da segunda navegação em diante, a tela montada não dá lugar a esqueleto', () => {
    const { events, esqueleto, passar } = setup();

    events.next(new NavigationStart(1, '/voleis'));
    events.next(fim('/voleis'));
    passar(1);
    expect(esqueleto()).toBe(false);

    // Trocar de aba, mesmo que demore: quem está na tela continua na tela.
    events.next(new NavigationStart(2, '/g/1/rankings'));
    passar(5000);

    expect(esqueleto()).toBe(false);
  });
});
