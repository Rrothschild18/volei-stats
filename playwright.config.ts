import { defineConfig, devices } from '@playwright/test';

/**
 * Uma suíte de ponta a ponta, duas metades, porque o que elas exigem para
 * rodar é diferente:
 *
 * - **`demo`** roda contra o cenário em memória (`ng serve --configuration
 *   demo`). Não precisa de Docker, cada aba começa do mesmo cenário, e por isso
 *   roda em paralelo. Cobre as telas de dentro do vôlei.
 * - **`banco`** roda contra o Supabase local, em Docker. Em série e com um
 *   trabalhador só, de propósito: os testes compartilham um banco, e o que se
 *   ganharia em paralelo se perderia em testes que enxergam o estado uns dos
 *   outros. Cobre o que só existe com servidor — entrar, criar vôlei, e um
 *   campeonato do zero ao fim.
 *
 * `pnpm test:e2e` roda as duas; `test:e2e:demo` e `test:e2e:banco` rodam uma.
 * `E2E_ALVO` existe para não subir o servidor da metade que não vai rodar.
 */
const alvo = process.env['E2E_ALVO'];
const naEsteira = !!process.env['CI'];

const PORTA_DEMO = 4300;
const PORTA_BANCO = 4321;
const URL_DEMO = `http://localhost:${PORTA_DEMO}`;
const URL_BANCO = process.env['E2E_BASE_URL'] ?? `http://localhost:${PORTA_BANCO}`;

const servidorDemo = {
  command: `pnpm start --configuration demo --port ${PORTA_DEMO}`,
  url: URL_DEMO,
  // Localmente aproveita o servidor que já está de pé; na pipeline sobe o dele.
  reuseExistingServer: !naEsteira,
  timeout: 180_000,
};

const servidorBanco = {
  command: `pnpm start --port ${PORTA_BANCO}`,
  url: URL_BANCO,
  reuseExistingServer: !naEsteira,
  timeout: 180_000,
};

/** O celular que o app foi desenhado para: 390 de largura. */
const celular = { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } };

export default defineConfig({
  // O device primeiro, o tamanho depois: ele traz toque e agente de celular, e
  // na ordem inversa o `viewport` dele sobrescrevia o nosso.
  forbidOnly: naEsteira,
  retries: naEsteira ? 1 : 0,
  /*
   * Um trabalhador por padrão, porque a metade `banco` compartilha o Postgres.
   * Quem roda só a metade `demo` pede mais pela linha de comando — é o que o
   * script `test:e2e:demo` faz.
   */
  workers: 1,
  // Na pipeline, o relatório em HTML é o que sobe como artefato quando falha.
  reporter: naEsteira ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  /* Esquenta as telas do demo antes de os testes concorrerem por elas. */
  globalSetup: './e2e/demo/global-setup.ts',
  projects: [
    {
      name: 'demo',
      testDir: './e2e/demo/specs',
      fullyParallel: true,
      use: { ...celular, baseURL: URL_DEMO },
    },
    {
      /* Um desktop só para pegar quebra de layout e de rota, sem duplicar a suíte. */
      name: 'demo-desktop',
      testDir: './e2e/demo/specs',
      testMatch: /navegacao\.spec\.ts/,
      fullyParallel: true,
      use: { ...devices['Desktop Chrome'], baseURL: URL_DEMO },
    },
    {
      name: 'banco',
      testDir: './e2e',
      /* A metade demo tem projeto próprio e servidor próprio. */
      testIgnore: '**/demo/**',
      fullyParallel: false,
      use: { ...celular, baseURL: URL_BANCO },
    },
  ],
  webServer:
    alvo === 'demo'
      ? [servidorDemo]
      : alvo === 'banco'
        ? [servidorBanco]
        : [servidorDemo, servidorBanco],
});
