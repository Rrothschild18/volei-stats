import { defineConfig, devices } from '@playwright/test';

/**
 * Os testes e2e rodam contra o app em modo demonstração (`ng serve
 * --configuration demo`): o cenário em memória de `src/app/core/mock/`, sem
 * Supabase nenhum. Ver `e2e/README.md`.
 *
 * O servidor é o próprio Playwright que sobe; se já houver um na 4300, ele
 * reusa (`reuseExistingServer`) — é o que torna rápido rodar um teste só
 * enquanto se mexe no app.
 */
const PORT = 4300;
/** Na esteira os testes são mais severos: sem `.only`, com repetição. */
const naEsteira = !!process.env['CI'];

export default defineConfig({
  testDir: './e2e/specs',
  /* Compila as telas uma vez antes de os testes concorrerem por elas. */
  globalSetup: './e2e/global-setup.ts',
  /* O app é só front-end: nada compartilhado entre testes, então paralelo. */
  fullyParallel: true,
  forbidOnly: naEsteira,
  retries: naEsteira ? 1 : 0,
  workers: naEsteira ? 2 : undefined,
  reporter: naEsteira ? [['github'], ['html', { open: 'never' }]] : [['list']],
  /*
   * Esperas: nenhum `waitForTimeout` nos testes — só estas, por condição. O
   * limite é folgado porque o servidor de desenvolvimento compila cada tela na
   * primeira vez que alguém pede por ela, e os testes pedem em paralelo.
   */
  expect: { timeout: 15_000 },
  timeout: 45_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    /* O app é desenhado para o telefone: é essa a tela que vale testar. */
    ...devices['Pixel 7'],
  },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    /* Um desktop só para pegar quebra de layout/rota, sem duplicar a suíte. */
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /navegacao\.spec\.ts/,
    },
  ],
  webServer: {
    command: `pnpm ng serve --configuration demo --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !naEsteira,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
