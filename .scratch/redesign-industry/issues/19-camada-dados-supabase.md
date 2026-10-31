# 19: Camada de dados Supabase (expand)

**What to build:** O app passa a poder falar com o Supabase sem deixar de funcionar com o IndexedDB. Os repositórios Supabase existem atrás da mesma fachada que as telas já usam, e o banco local sobe com o cenário de exemplo pra dar pra clicar no app contra back-end de verdade.

**Blocked by:** 18

**Status:** ready-for-agent

- [ ] `@supabase/supabase-js` e um `SupabaseService` com URL e chave publicável por ambiente
- [ ] Sessão anônima criada na primeira visita e guardada no navegador
- [ ] Tipos gerados do schema
- [ ] Repositórios Supabase implementando as mesmas operações da fachada atual
- [ ] Leituras com join em vez de laço por jogador (fim do N+1)
- [ ] Rankings leem as views `player_stats` / `team_stats`; o perfil segue calculado no cliente
- [ ] `supabase/seed.sql` com o cenário do redesign, aplicado pelo `supabase start`
- [ ] O IndexedDB continua sendo o caminho padrão
