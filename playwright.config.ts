import { defineConfig, devices } from '@playwright/test';

/**
 * Os testes de ponta a ponta rodam contra o Supabase local, em Docker.
 *
 * Em série e com um trabalhador só, de propósito: eles compartilham um banco, e
 * o que se ganharia em paralelo se perderia em testes que enxergam o estado uns
 * dos outros. São dois arquivos curtos — o tempo total não é o problema.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4321',
    viewport: { width: 390, height: 844 },
    ...devices['Pixel 7'],
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm start --port 4321',
    url: 'http://localhost:4321',
    // Localmente aproveita o servidor que já está de pé; na pipeline sobe o dele.
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
