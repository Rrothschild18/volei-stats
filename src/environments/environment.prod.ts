/**
 * O app na nuvem (build de produção).
 *
 * Os valores nascem vazios aqui de propósito: quem os preenche é o deploy, a
 * partir das variáveis do GitHub Actions (`scripts/env-producao.mjs`). Assim o
 * endereço do seu projeto não fica no repositório, e trocá-lo é mexer numa tela
 * de configuração em vez de fazer um commit.
 *
 * A chave que entra aqui é a **publicável** (`sb_publishable_…`, antes `anon`).
 * Ela vai para o bundle que o GitHub Pages serve, então é pública por
 * construção — o que protege os dados são as políticas do banco e o captcha no
 * login anônimo, não o sigilo dela. A chave **secreta** (`sb_secret_…`, antes
 * `service_role`) ignora as políticas e nunca entra num app de navegador.
 *
 * Com os valores vazios o build compila, mas o app não sobe: `createClient`
 * recusa uma URL vazia. É de propósito — um deploy sem as variáveis falha de
 * cara, em vez de publicar uma tela que não carrega nada.
 */
export const environment = {
  dataSource: 'supabase' as 'supabase' | 'demo',
  supabaseUrl: '',
  supabasePublishableKey: '',
};
