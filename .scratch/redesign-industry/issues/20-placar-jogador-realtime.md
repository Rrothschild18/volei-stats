# 20: Placar pelo jogador e tempo real

**What to build:** O jogador lança o placar da partida dele de verdade, contra o banco, e o primeiro placar salvo trava para todo mundo. Os outros aparelhos na quadra não precisam de refresh: quando alguém lança um placar ou o admin decide um par-ou-ímpar, as telas se atualizam sozinhas.

**Blocked by:** 10, 12, 19

**Status:** ready-for-agent

- [ ] RPC `report_match_score` exigindo que o chamador esteja numa das duas duplas naquele grupo
- [ ] O `unique` existente garante a trava do primeiro insert; a segunda tentativa recebe o placar já lançado
- [ ] `reported_by` gravado; correção por UPDATE só de admin, gravando `corrected_by`/`corrected_at`
- [ ] Decisões de quadra escritas só por admin
- [ ] Início, Fila, Chave e Placar recarregam o estado do campeonato ao receber evento de Realtime
- [ ] A chave pausada de um aparelho destrava sozinha quando o admin decide no outro
