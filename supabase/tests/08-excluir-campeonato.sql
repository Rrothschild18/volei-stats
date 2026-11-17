-- =============================================================================
-- Excluir um campeonato, e em que ordem (ticket 45).
--
-- Excluir apaga o campeonato E o sorteio que o gerou: senão o sorteio fica
-- "escolhido e sem campeonato", que é exatamente a definição de sorteio
-- pendente (src/app/core/rules/pending-draw.ts) — o app passaria a oferecer
-- "COMEÇAR O PRÓXIMO" com as duplas do campeonato que alguém acabou de apagar.
--
-- Só que `tournaments.draw_id` é `on delete restrict`. Apagar o sorteio
-- primeiro, que era o que o cliente fazia, não dá erro silencioso: dá violação
-- de chave estrangeira, e o excluir inteiro morre ali. Para quem NÃO é dono
-- isso nunca aparecia — a RLS filtra a linha, o delete volta vazio e o fluxo
-- segue —, e dono é justamente quem usa o botão.
--
-- Esta suíte fixa a ordem: campeonato primeiro, sorteio depois.
-- =============================================================================
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),  -- Raul, dono
  ('22222222-2222-2222-2222-222222222222');  -- Vitoria, jogadora

create or replace function assert(cond boolean, msg text)
returns void language plpgsql as $$
begin if not cond then raise exception 'FALHOU: %', msg; end if; end $$;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
create temp table ctx as
  select * from create_group('Volei de Terca','Raul','M','1990-05-10','volei99');
select add_player((select group_id from ctx), n, g)
from (values ('Vitoria','F'),('Willy','M'),('Be','F')) as v(n,g);
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select redeem_invite((select invite_token from ctx));
select claim_player((select group_id from ctx), 'Vitoria', 'volei99', '1990-05-10');
commit;

-- Um campeonato em ANDAMENTO: duas duplas, uma partida lançada, sem final.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
create temp table ids as select
  (select group_id from ctx) as g,
  gen_random_uuid() as sess,
  gen_random_uuid() as draw,
  gen_random_uuid() as tour,
  gen_random_uuid() as ta,
  gen_random_uuid() as tb,
  gen_random_uuid() as m1;

insert into sessions (id, group_id, date) select sess, g, current_date from ids;
insert into draws (id, group_id, session_id, selected) select draw, g, sess, true from ids;
insert into tournaments (id, group_id, session_id, draw_id, name, format_id, point_limit)
  select tour, g, sess, draw, 'Teste', 'knockout-4', 12 from ids;
insert into tournament_teams (id, group_id, tournament_id, position, player1_id, player2_id)
  select ta, g, tour, 1,
    (select id from players where group_id = ids.g and name = 'Raul'),
    (select id from players where group_id = ids.g and name = 'Vitoria') from ids;
insert into tournament_teams (id, group_id, tournament_id, position, player1_id, player2_id)
  select tb, g, tour, 2,
    (select id from players where group_id = ids.g and name = 'Willy'),
    (select id from players where group_id = ids.g and name = 'Be') from ids;
insert into matches (id, group_id, tournament_id, session_id, phase, team_a_id, team_b_id, score_a, score_b)
  select m1, g, tour, sess, 'round-1', ta, tb, 12, 9 from ids;
commit;

-- ===== 1. APAGAR O SORTEIO ANTES DO CAMPEONATO NÃO DÁ =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
declare ok boolean := false;
begin
  begin
    delete from draws where id = (select draw from ids);
  exception when others then ok := true;
  end;
  perform assert(ok, 'o sorteio não sai enquanto o campeonato apontar para ele');
end $$;
commit;

select assert(
  (select count(*) from tournaments where id = (select tour from ids)) = 1,
  'e o campeonato continua lá');

-- ===== 2. QUEM NÃO É DONO NÃO APAGA, E NÃO RECEBE ERRO =====
-- A RLS filtra a linha em vez de recusar o comando: o delete volta vazio. É o
-- que fazia o defeito acima passar despercebido por quem testava como jogador.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
delete from tournaments where id = (select tour from ids);
commit;

select assert(
  (select count(*) from tournaments where id = (select tour from ids)) = 1,
  'jogadora não apaga campeonato, e o banco não reclama');

-- ===== 3. NA ORDEM CERTA, O DONO APAGA TUDO =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
delete from tournaments where id = (select tour from ids);
delete from draws where id = (select draw from ids);
commit;

select assert(
  (select count(*) from tournaments where id = (select tour from ids)) = 0,
  'o campeonato em andamento sai');
select assert(
  (select count(*) from matches where id = (select m1 from ids)) = 0,
  'e as partidas dele vão por cascata, mesmo com placar lançado');
select assert(
  (select count(*) from tournament_teams where tournament_id = (select tour from ids)) = 0,
  'e as duplas também');
select assert(
  (select count(*) from draws where id = (select draw from ids)) = 0,
  'e o sorteio sai depois, para não virar sorteio pendente');
select assert(
  (select count(*) from sessions where id = (select sess from ids)) = 1,
  'a sessão do dia continua de pé: excluir campeonato não é fechar o dia');
