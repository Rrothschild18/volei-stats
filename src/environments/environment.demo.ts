/**
 * O app sem banco: o cenário em memória de `core/mock/`.
 *
 * É esta a configuração que os testes e2e servem (`pnpm start:demo`), porque o
 * cenário é o mesmo em qualquer máquina e volta ao início a cada aba nova — é o
 * que faz o teste ser repetível. As telas de entrada (código, criar vôlei,
 * dizer quem você é) dependem do servidor e não existem aqui; ver `e2e/README.md`.
 */
export const environment = {
  dataSource: 'demo' as 'supabase' | 'demo',
  supabaseUrl: '',
  supabasePublishableKey: '',
};
