-- =============================================================================
-- A posição da dupla passa a ser conferida no fim da statement, não linha a
-- linha (ticket 44).
--
-- A ordem das duplas É a chave: a primeira enfrenta a segunda, a terceira a
-- quarta. Reordenar os confrontos, portanto, é trocar `position` — e trocar
-- duas posições é, inevitavelmente, passar por um instante em que duas linhas
-- querem o mesmo número.
--
-- `unique (tournament_id, position)` não-deferrable é conferido LINHA A LINHA.
-- O cliente regrava todas as duplas numa statement só (o `upsert` do
-- repositório), e a troca 2 ↔ 3 morria em chave repetida no meio do próprio
-- comando, com o campeonato rolando e alguém esperando na quadra. Reproduzido
-- em `supabase/tests/07-reordenar-duplas.sql` antes desta migration existir.
--
-- `deferrable initially immediate` muda só o INSTANTE da conferência: passa a
-- ser o fim da statement. Duas duplas na mesma posição continuam proibidas —
-- é o terceiro caso daquela suíte, e ele continua verde. O que deixa de ser
-- proibido é o caminho entre um estado válido e outro.
--
-- Não é `initially deferred` de propósito: adiar até o commit esconderia o erro
-- até longe de quem o causou, e aqui não há transação de várias statements para
-- justificar isso.
-- =============================================================================
alter table tournament_teams
  drop constraint tournament_teams_tournament_id_position_key;

alter table tournament_teams
  add constraint tournament_teams_tournament_id_position_key
  unique (tournament_id, position) deferrable initially immediate;
