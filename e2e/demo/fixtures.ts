import { test as base, expect, Page } from '@playwright/test';
import { GrupoPage } from './pages/grupo.page';
import { VoleisPage } from './pages/voleis.page';

/**
 * O que todo teste ganha de graça.
 *
 * No modo demonstração você é sempre a mesma pessoa — o Caio, jogador no Vôlei
 * Segunda e dono do Vôlei Trabalho. É esse par que deixa testar os dois papéis
 * sem trocar de identidade: o que é de dono se vê no Trabalho, o que é de
 * jogador se vê no Segunda.
 */
interface Fixtures {
  readonly voleis: VoleisPage;
  readonly grupo: GrupoPage;
}

export const test = base.extend<Fixtures>({
  voleis: async ({ page }, use) => {
    await use(new VoleisPage(page));
  },
  grupo: async ({ page }, use) => {
    await use(new GrupoPage(page));
  },
});

export { expect };
export type { Page };
