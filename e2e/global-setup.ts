import { chromium, FullConfig } from '@playwright/test';

/**
 * Esquenta o servidor antes do primeiro teste.
 *
 * O `ng serve` compila cada tela na primeira vez que alguém pede por ela, e os
 * testes pedem várias ao mesmo tempo: num servidor frio, a primeira visita a
 * uma tela demora segundos. Visitar cada uma aqui, em série, tira essa espera
 * de dentro dos testes — é a diferença entre um teste estável e um que às vezes
 * estoura o tempo na esteira.
 */
const TELAS = [
  '/voleis',
  /* A rota que não existe: ela cai no `index.html` por outro caminho. */
  '/isso-nao-existe',
  '/entrar',
  '/g/g-segunda/inicio',
  '/g/g-segunda/campeonatos',
  '/g/g-segunda/campeonatos/sessoes/nova',
  '/g/g-segunda/campeonatos/sessoes/s-hoje',
  '/g/g-segunda/rankings',
  '/g/g-segunda/jogadores',
  '/g/g-segunda/jogadores/p-bia',
];

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:4300';
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const tela of TELAS) {
    await page.goto(`${baseURL}${tela}`, { waitUntil: 'networkidle' });
  }

  await browser.close();
}
