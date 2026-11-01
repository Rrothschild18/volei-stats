import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { NetProgressComponent } from './net-progress.component';
import { NetworkActivityService } from '../../../core/net/network-activity.service';

/**
 * O atraso é a regra que importa aqui: barra que pisca a cada toque rápido lê
 * como defeito, e não como espera. O teste prende o pedido para poder olhar a
 * tela nos dois instantes — antes e depois dos 300 ms.
 */
describe('NetProgressComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const activity = TestBed.configureTestingModule({}).inject(NetworkActivityService);
    const fixture = TestBed.createComponent(NetProgressComponent);
    fixture.detectChanges();

    return {
      activity,
      fixture,
      bar: () => fixture.nativeElement.querySelector('[role="progressbar"]') as Element | null,
    };
  }

  it('não aparece com o app parado', () => {
    expect(setup().bar()).toBeNull();
  });

  it('espera o atraso antes de aparecer, e some quando o pedido volta', async () => {
    const { activity, fixture, bar } = setup();

    let release!: () => void;
    const pending = activity.track(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    fixture.detectChanges();
    expect(bar()).toBeNull();

    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    expect(bar()).not.toBeNull();

    release();
    await pending;
    fixture.detectChanges();
    expect(bar()).toBeNull();
  });

  it('o pedido rápido não chega a piscar', async () => {
    const { activity, fixture, bar } = setup();

    await activity.track(() => Promise.resolve());
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    expect(bar()).toBeNull();
  });
});
