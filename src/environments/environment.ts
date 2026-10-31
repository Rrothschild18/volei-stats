/**
 * De onde o app lê os dados.
 *
 * As credenciais daqui são do Supabase **local** (`supabase start`): são fixas,
 * iguais em qualquer máquina, e não são segredo. A chave publicável é pública
 * por projeto — o que protege os dados são as políticas do banco, não ela.
 *
 * Quando houver projeto na nuvem, é este arquivo que ganha um par para
 * produção; nada no resto do app sabe a URL.
 */
export const environment = {
  /** `supabase` fala com o Postgres. `demo` usa o cenário em memória. */
  dataSource: 'supabase' as 'supabase' | 'demo',
  supabaseUrl: 'http://127.0.0.1:54321',
  supabasePublishableKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
};
