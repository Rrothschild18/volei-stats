import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeError, OFFLINE_MESSAGE } from './error.util';

describe('describeError', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('traduz uma violação de chave estrangeira, qualquer que seja a tabela', () => {
    const cause = new Error(
      'insert or update on table "invite_redeem_attempts" violates foreign key constraint "invite_redeem_attempts_user_id_fkey"',
    );

    expect(describeError(cause)).toBe(
      'Essa ação depende de algo que não existe mais. Atualize a tela e tente de novo.',
    );
  });

  it('traduz unicidade de nome de jogador para a frase conhecida', () => {
    const cause = new Error('duplicate key value violates unique constraint "players_name_key"');

    expect(describeError(cause)).toBe('Já tem alguém com esse nome neste vôlei. Escolha outro.');
  });

  it('traduz o formato do código de convite', () => {
    const cause = new Error(
      'new row for relation "invites" violates check constraint "invites_code_shape"',
    );

    expect(describeError(cause)).toBe(
      'O código aceita letras, números e hífen, com pelo menos 3 caracteres.',
    );
  });

  it('nunca mostra texto cru do banco que nenhuma regra reconheceu', () => {
    const cause = new Error('relation "nao_existe" does not exist');

    expect(describeError(cause, 'Não foi possível salvar.')).toBe('Não foi possível salvar.');
  });

  it('devolve o próprio texto quando ele já foi escrito para alguém ler', () => {
    const cause = new Error('Este vôlei não tem convite aberto');

    expect(describeError(cause)).toBe('Este vôlei não tem convite aberto');
  });

  it('prioriza a mensagem de offline mesmo com uma causa de banco', () => {
    vi.stubGlobal('navigator', { onLine: false });

    expect(describeError(new Error('qualquer coisa'))).toBe(OFFLINE_MESSAGE);
  });

  it('reconhece "failed to fetch" como falha de rede mesmo online', () => {
    expect(describeError(new Error('Failed to fetch'))).toBe(OFFLINE_MESSAGE);
  });

  it('usa o fallback quando a causa não é um erro', () => {
    expect(describeError('string qualquer', 'Não deu certo.')).toBe('Não deu certo.');
  });
});
