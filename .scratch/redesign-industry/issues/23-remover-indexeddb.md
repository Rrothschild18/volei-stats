# 23: Remover o IndexedDB (contract)

**What to build:** Com o Supabase no ar, o caminho antigo sai. O armazenamento local deixa de existir no app, e o cenário de exemplo sobrevive como **modo demo** — um jeito de abrir o app sem rede e sem banco, pra demonstrar e pra testar.

**Blocked by:** 21, 22

**Status:** ready-for-agent

- [ ] Repositórios, config e serviço do IndexedDB removidos
- [ ] O mock vira implementação da interface de repositório, atrás de um modo demo explícito
- [ ] Dependências e estilos do Angular Material fora do caminho de produção
- [ ] Material Icons, Material Symbols, Plus Jakarta e o `@theme` antigo removidos
- [ ] Build, lint e a suíte de testes passando sem eles
