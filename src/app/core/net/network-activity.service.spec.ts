import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { NetworkActivityService } from './network-activity.service';

/**
 * A conta de pedidos em voo, que é o que acende a barra do topo.
 *
 * O que se testa aqui é o caso que um booleano erraria: dois pedidos em
 * paralelo, e o primeiro a voltar não pode apagar a espera do outro.
 */
describe('NetworkActivityService', () => {
  function create(): NetworkActivityService {
    return TestBed.configureTestingModule({}).inject(NetworkActivityService);
  }

  it('fica parado enquanto não há pedido', () => {
    expect(create().active()).toBe(false);
  });

  it('acende durante o pedido e apaga no fim', async () => {
    const activity = create();
    let release!: () => void;
    const pending = activity.track(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    expect(activity.active()).toBe(true);

    release();
    await pending;

    expect(activity.active()).toBe(false);
  });

  it('o pedido que falha também sai da conta', async () => {
    const activity = create();

    await expect(
      activity.track(() => Promise.reject(new Error('sem conexão'))),
    ).rejects.toThrowError('sem conexão');

    expect(activity.active()).toBe(false);
  });

  it('o primeiro a voltar não apaga a espera do segundo', async () => {
    const activity = create();
    let releaseSlow!: () => void;

    const slow = activity.track(
      () =>
        new Promise<void>((resolve) => {
          releaseSlow = resolve;
        }),
    );
    const fast = activity.track(() => Promise.resolve());

    await fast;
    expect(activity.active()).toBe(true);

    releaseSlow();
    await slow;
    expect(activity.active()).toBe(false);
  });
});
