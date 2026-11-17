-- =============================================================================
-- A sequência de ralis de uma partida (ticket 08)
--
-- O placar final não diz de quem era o saque: 12 × 10 pode ter sido milhares
-- de sequências, e cada uma deixa o saque num lugar. A folha de placar passou a
-- acompanhar o saque a cada toque no `+`, e a ordem dos pontos que ela vê é
-- guardada aqui — é o que um dia permite contar virada e sequência de pontos.
--
-- 0 = a primeira dupla (team_a) ganhou o rali; 1 = a segunda (team_b).
--
-- ANULÁVEL: quem digita o placar de uma vez não disse a ordem, e as partidas
-- antigas não têm. E não há constraint amarrando a sequência ao placar, de
-- propósito: `correct_match_score` reescreve o placar sem saber da sequência,
-- e uma constraint faria toda correção de partida com sequência falhar. Quem lê
-- confere: sequência cuja contagem não bate com o placar é sequência velha, e
-- vale como se não existisse.
-- =============================================================================

alter table matches
  add column rally_log smallint[];

alter table matches
  add constraint matches_rally_log_so_zero_e_um
    check (rally_log is null or rally_log <@ array[0, 1]::smallint[]);
