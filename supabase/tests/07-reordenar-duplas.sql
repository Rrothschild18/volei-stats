-- =============================================================================
-- Reordenar as duplas da chave (ticket 44).
--
-- A ordem das duplas É o confronto: `generateInitialMatches` casa a primeira
-- com a segunda, a terceira com a quarta. Reordenar, no banco, é trocar
-- `tournament_teams.position` — e essa coluna tem `unique (tournament_id,
-- position)`.
--
-- O que esta suíte precisa provar é uma coisa só, e é a que o cliente faz:
-- o `upsert` do repositório regrava TODAS as duplas numa statement só, com as
-- posições já trocadas. Com um índice único não-deferrable, isso pode bater em
-- chave repetida no meio do próprio comando. É o tipo de coisa que não se
-- descobre em produção, na quadra, com o campeonato rolando.
-- =============================================================================
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),  -- Raul, dono
  ('22222222-2222-2222-2222-222222222222');  -- Vitoria, jogadora

create or replace function assert(cond boolean, msg text)
returns void language plpgsql as $$
begin if not cond then raise exception 'FALHOU: %', msg; end if; end $$;

-- fixture: o vôlei, o pessoal e um campeonato de quatro duplas
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
create temp table ctx as
  select * from create_group('Volei de Terca','Raul','M','1990-05-10','volei99');
select add_player((select group_id from ctx), n, g)
from (values ('Vitoria','F'),('Willy','M'),('Be','F'),('Duda','F'),('Leo','M'),('Caio','M')) as v(n,g);
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select redeem_invite((select invite_token from ctx));
select claim_player((select group_id from ctx), 'Vitoria', 'volei99', '1990-05-10');
commit;

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
  gen_random_uuid() as tc,
  gen_random_uuid() as td;

insert into sessions (id, group_id, date) select sess, g, current_date from ids;
insert into draws (id, group_id, session_id) select draw, g, sess from ids;
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
insert into tournament_teams (id, group_id, tournament_id, position, player1_id, player2_id)
  select tc, g, tour, 3,
    (select id from players where group_id = ids.g and name = 'Duda'),
    (select id from players where group_id = ids.g and name = 'Leo') from ids;
insert into tournament_teams (id, group_id, tournament_id, position, player1_id, player2_id)
  select td, g, tour, 4,
    (select id from players where group_id = ids.g and name = 'Caio'),
    (select id from players where group_id = ids.g and name = 'Raul') from ids;
commit;

-- ===== 1. A TROCA, DO JEITO QUE O CLIENTE FAZ =====
-- Uma statement só, todas as linhas, posições já trocadas: 2 ↔ 3.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare ok boolean := true;
begin
  begin
    insert into tournament_teams
      (id, group_id, tournament_id, position, player1_id, player2_id,
       eliminated, eliminated_directly, synthetic)
    select t.id, t.group_id, t.tournament_id,
      case t.position when 2 then 3 when 3 then 2 else t.position end,
      t.player1_id, t.player2_id, t.eliminated, t.eliminated_directly, t.synthetic
    from tournament_teams t where t.tournament_id = (select tour from ids)
    on conflict (id) do update set position = excluded.position;
  exception when others then ok := false;
  end;
  perform assert(ok, 'a troca de posições numa statement só não pode bater em chave repetida');
end $$;
commit;

select assert(
  (select position from tournament_teams where id = (select tc from ids)) = 2,
  'a terceira dupla subiu para a segunda posição');
select assert(
  (select position from tournament_teams where id = (select tb from ids)) = 3,
  'e a segunda desceu para a terceira');

-- ===== 2. REORDENAR NÃO É APAGAR =====
-- A dupla continua sendo a mesma linha, com os mesmos jogadores: é isso que
-- faz os placares sobreviverem à reordenação.
select assert(
  (select count(*) from tournament_teams where tournament_id = (select tour from ids)) = 4,
  'nenhuma dupla some numa reordenação');

-- ===== 3. DUAS DUPLAS NA MESMA POSIÇÃO CONTINUAM PROIBIDAS =====
-- A trava que torna a reordenação delicada é a mesma que mantém a chave
-- legível. Ela não pode ter sido afrouxada por engano.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare ok boolean := false;
begin
  begin
    update tournament_teams set position = 1 where id = (select td from ids);
  exception when others then ok := true;
  end;
  perform assert(ok, 'duas duplas na mesma posição continuam proibidas');
end $$;
commit;
