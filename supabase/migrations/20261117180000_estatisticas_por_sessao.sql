-- =============================================================================
-- Estatísticas por sessão: a janela das últimas noites (ticket 04)
--
-- `player_stats` e `team_stats` somam TUDO, sem filtro de sessão — a soma já
-- chega fechada no cliente, e não havia como pedir "só as últimas 4 noites".
-- Estas views devolvem a mesma conta quebrada por noite; quem soma a janela é
-- o app, que é quem sabe quais noites estão na tela.
--
-- Nenhuma das duas traz aproveitamento, de propósito: porcentagem não se soma.
-- O cliente recalcula do total (`sumPlayerStats`/`sumTeamStats`).
--
-- As views antigas continuam existindo: elas ainda são o total de todos os
-- tempos, que o perfil do jogador e o cartão do vôlei usam.
-- =============================================================================

-- Jogos e esperas da MESMA noite, lado a lado.
--
-- É `full join` porque as duas pontas existem sozinhas: quem só esperou não
-- tem partida naquela noite, e um sorteio sem avulso não tem espera. Com
-- `left join` quem passou a noite inteira esperando sumiria da conta de
-- esperas — que é justamente a única coisa que ele teria a mostrar.
create or replace view player_session_stats
with (security_invoker = true) as
with jogos as (
  select
    group_id,
    session_id,
    player_id,
    count(*)                        as games_played,
    count(*) filter (where won)     as wins,
    count(*) filter (where not won) as losses
  from player_match_results
  group by group_id, session_id, player_id
),
esperas as (
  -- Só o sorteio ESCOLHIDO conta como espera: as três propostas de um sorteio
  -- são a mesma espera (REGRAS.md §7.6).
  select
    group_id,
    session_id,
    waiting_player_id as player_id,
    count(*)          as times_waited
  from draws
  where selected and waiting_player_id is not null
  group by group_id, session_id, waiting_player_id
)
select
  coalesce(j.group_id,   e.group_id)   as group_id,
  coalesce(j.session_id, e.session_id) as session_id,
  coalesce(j.player_id,  e.player_id)  as player_id,
  coalesce(j.games_played, 0)          as games_played,
  coalesce(j.wins,         0)          as wins,
  coalesce(j.losses,       0)          as losses,
  coalesce(e.times_waited, 0)          as times_waited
from jogos j
full join esperas e
  on  e.group_id   = j.group_id
  and e.session_id = j.session_id
  and e.player_id  = j.player_id;

-- Dupla identificada pelo PAR de jogadores, como em `team_stats`: a mesma
-- dupla sorteada em dias diferentes é a mesma dupla.
create or replace view team_session_stats
with (security_invoker = true) as
with team_matches as (
  select
    m.group_id,
    m.session_id,
    least(t.player1_id, t.player2_id)    as p1,
    greatest(t.player1_id, t.player2_id) as p2,
    (m.winner_id = t.id)                 as won
  from matches m
  join tournament_teams t on t.id in (m.team_a_id, m.team_b_id)
)
select
  group_id,
  session_id,
  p1 as player1_id,
  p2 as player2_id,
  count(*)                        as games_played,
  count(*) filter (where won)     as wins,
  count(*) filter (where not won) as losses
from team_matches
group by group_id, session_id, p1, p2;
