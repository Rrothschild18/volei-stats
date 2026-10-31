import { expect, test } from '../fixtures';

/**
 * Quem pode o quê. As telas de dono não renderizam para jogador, e as rotas de
 * dono redirecionam — um esconde, o outro tranca, e os dois precisam valer.
 *
 * O que depende do servidor (entrar por código, criar vôlei, dizer quem você é)
 * não é testável sem o Supabase; ver `e2e/README.md`.
 */
test.describe('acesso', () => {
  test('jogador que abre a rota de convite cai no início do vôlei', async ({ page, grupo }) => {
    await grupo.abrir('convite');

    await expect(page).toHaveURL(/\/g\/g-segunda\/inicio$/);
  });

  test('o dono entra na rota de convite', async ({ page, comoAlguem, grupo }) => {
    await comoAlguem('Rafa');
    await grupo.abrir('convite');

    await expect(page).toHaveURL(/\/convite$/);
  });

  test('vôlei de que a pessoa não participa manda para a porta do app', async ({ page, grupo }) => {
    await grupo.abrir('inicio', 'g-nao-existe');

    await expect(page).toHaveURL(/\/entrar$/);
    await expect(page.getByRole('heading', { name: 'ENTRAR NUM VÔLEI' })).toBeVisible();
  });
});
