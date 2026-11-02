import { describe, expect, it } from 'vitest';
import { mensagemDeFalha, migrationsPendentes } from './checar-migrations.mjs';

/**
 * As duas saídas são reais, colhidas do projeto da nuvem em 01/11/2026: a
 * primeira antes de `supabase db push`, a segunda depois. Elas são o contrato
 * com o CLI — se a forma mudar, é aqui que se descobre, e não num deploy que
 * publicou app na frente do schema.
 */
const PENDENTES = `Initialising login role...
Connecting to remote database...
{"migrations":[{"local":"20261031000000","remote":"20261031000000","time":"2026-10-31 00:00:00"},{"local":"20261101120000","remote":"","time":"2026-11-01 12:00:00"},{"local":"20261101130000","remote":"","time":"2026-11-01 13:00:00"}],"message":"Migrations listed"}`;

const EM_DIA = `Initialising login role...
Connecting to remote database...
{"migrations":[{"local":"20261031000000","remote":"20261031000000","time":"2026-10-31 00:00:00"},{"local":"20261101120000","remote":"20261101120000","time":"2026-11-01 12:00:00"},{"local":"20261101130000","remote":"20261101130000","time":"2026-11-01 13:00:00"}],"message":"Migrations listed"}`;

describe('migrationsPendentes', () => {
  it('acha as migrations que a nuvem ainda não aplicou', () => {
    expect(migrationsPendentes(PENDENTES)).toEqual(['20261101120000', '20261101130000']);
  });

  it('com tudo aplicado, não acha nada', () => {
    expect(migrationsPendentes(EM_DIA)).toEqual([]);
  });
});

describe('mensagemDeFalha', () => {
  it('nomeia cada migration que falta e diz o comando que resolve', () => {
    const mensagem = mensagemDeFalha(['20261101120000', '20261101130000']);

    expect(mensagem).toContain('20261101120000');
    expect(mensagem).toContain('20261101130000');
    expect(mensagem).toContain('supabase db push --linked');
  });

  it('diz quantas são, para quem lê o log de relance', () => {
    expect(mensagemDeFalha(['20261101120000'])).toContain('1 migration');
    expect(mensagemDeFalha(['20261101120000', '20261101130000'])).toContain('2 migrations');
  });
});

/**
 * A saída do CLI não é um contrato nosso, é dele. Estes casos são o que
 * acontece quando ela não vem como esperado — e o que importa aqui é a
 * DIREÇÃO da falha: um portão que não consegue perguntar tem de gritar, nunca
 * deixar passar.
 */
describe('quando a saída do CLI não vem como esperado', () => {
  it('aceita JSON indentado, não só o de uma linha', () => {
    const indentado = `Connecting to remote database...
{
  "migrations": [
    { "local": "20261031000000", "remote": "20261031000000" },
    { "local": "20261101120000", "remote": "" }
  ],
  "message": "Migrations listed"
}`;

    expect(migrationsPendentes(indentado)).toEqual(['20261101120000']);
  });

  it('saída sem JSON nenhum é erro, não lista vazia', () => {
    expect(() => migrationsPendentes('Cannot find project ref.')).toThrow(/não trouxe JSON/);
  });

  it('JSON quebrado também, com a saída junto para quem for depurar', () => {
    expect(() => migrationsPendentes('{"migrations": [')).toThrow(/não deu para ler/i);
  });

  it('JSON de erro do CLI não vira "nada pendente"', () => {
    // O CLI responde erro no mesmo formato, e um portão que lesse isto como
    // lista vazia publicaria o app na frente do schema exatamente quando o
    // banco está inalcançável.
    const erro = '{"_tag":"Error","error":{"code":"DbConfigLoginRoleStatusError"}}';
    expect(() => migrationsPendentes(erro)).toThrow(/lista de migrations/);
  });
});
