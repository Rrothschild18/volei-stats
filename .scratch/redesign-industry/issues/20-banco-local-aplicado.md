# 20: Banco local aplicado, com cenário

**What to build:** `supabase db reset` monta o banco inteiro e já o popula com o cenário de exemplo. Hoje o schema só é aplicado pelos testes, num Postgres descartável — o banco local sobe vazio. Ao fim deste ticket dá para abrir o Studio e ver os vôleis, a sessão de hoje e o campeonato.

**Blocked by:** 19

**Status:** done

- [x] O schema é a migration inicial, aplicada pelo `supabase start` e pelo `db reset`
- [x] A suíte SQL passa a aplicar a mesma migration, sem schema duplicado em dois lugares
- [x] Cenário de exemplo com os dois vôleis do redesign, sessão de hoje e campeonato em andamento
- [x] Um vôlei de teste com código `TESTE-VOLEI`, data inicial 01/01/1990 e Raul cadastrado e ainda não reivindicado
- [x] O cenário é idempotente: `db reset` duas vezes seguidas dá o mesmo banco
