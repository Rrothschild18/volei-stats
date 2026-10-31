import { test as base, expect, Page } from '@playwright/test';
import { GrupoPage } from './pages/grupo.page';
import { VoleisPage } from './pages/voleis.page';

/**
 * O que todo teste ganha de graça.
 *
 * `voleis` e `grupo` são as duas telas por onde tudo passa. `comoRafa` e
 * `comoCaio` são os dois papéis do cenário — dono e jogador do Vôlei Segunda —,
 * e é trocando entre eles que se testa quem pode o quê.
 */
interface Fixtures {
  readonly voleis: VoleisPage;
  readonly grupo: GrupoPage;
  /** Assume uma pessoa do cenário e devolve a lista de vôleis dela. */
  readonly comoAlguem: (nome: string) => Promise<VoleisPage>;
}

export const test = base.extend<Fixtures>({
  voleis: async ({ page }, use) => {
    await use(new VoleisPage(page));
  },
  grupo: async ({ page }, use) => {
    await use(new GrupoPage(page));
  },
  comoAlguem: async ({ page }, use) => {
    await use(async (nome: string) => {
      const voleis = new VoleisPage(page);
      await voleis.abrir();
      await voleis.entrarComo(nome);
      return voleis;
    });
  },
});

export { expect };
export type { Page };
