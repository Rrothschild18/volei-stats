# 18: Supabase · esquema e camada de dados (expand)

**What to build:** O app passa a poder falar com o Supabase sem deixar de funcionar com o IndexedDB. O esquema ganha o que o redesign pede, os repositórios Supabase existem atrás da mesma fachada que as telas já usam, e os dados de hoje migram.

**Blocked by:** 12

**Status:** ready-for-agent

- [ ] Cliente Supabase configurado por ambiente
- [ ] `tournaments.format_id` not null no esquema
- [ ] Tabela `tiebreak_decisions(tournament_id, kind, winner_team_id, decided_by, decided_at)`
- [ ] `decided_by`/`decided_at` em `odd_player_placements`; `reported_by`, `corrected_by`, `corrected_at` em `matches`
- [ ] Realtime habilitado em `matches`, `odd_player_placements`, `tiebreak_decisions` e `tournaments`
- [ ] Repositórios Supabase implementando as mesmas operações da fachada atual
- [ ] Leituras com join em vez de laço por jogador (fim do N+1)
- [ ] Migração dos dados do IndexedDB
- [ ] O IndexedDB continua sendo o caminho padrão até o ticket 20
