-- =============================================================================
-- A regra do placar no banco: limite de pontos com dois de diferença.
--
-- A tela já recusa 12 × 11 e 18 × 3 num campeonato de 12. Esta suíte existe
-- porque a tela é UMA porta: aba velha, link antigo, outro cliente ou um `curl`
-- entram pelas outras. E placar impossível não fica parado — ele decide quem
-- vai à final.
--
-- O que ela precisa provar, nesta ordem: o placar certo entra, o impossível
-- não, o jogo interrompido continua entrando, e a correção (que é UPDATE)
-- passa pela mesma régua.
-- =============================================================================
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),  -- Raul, dono
  ('22222222-2222-2222-2222-222222222222');  -- Vitoria, jogadora

create or replace function assert(cond boolean, msg text)
returns void language plpgsql as $$
begin if not cond then raise exception 'FALHOU: %', msg; end if; end $$;

-- Tenta gravar e diz se o banco recusou. Sem isto, cada caso vira um bloco de
-- seis linhas e a suíte deixa de ser legível.
create or replace function recusa_insert(p_a int, p_b int)
returns boolean language plpgsql as $$
declare ok boolean := false;
begin
  begin
    insert into matches (group_id, tournament_id, session_id, phase, team_a_id, team_b_id, score_a, score_b)
      select g, tour, sess, 'round-1', ta, tb, p_a, p_b from ids;
    delete from matches where tournament_id = (select tour from ids) and phase = 'round-1';
  exception when others then ok := true;
  end;
  return ok;
end $$;

create or replace function recusa_update(p_a int, p_b int)
returns boolean language plpgsql as $$
declare ok boolean := false;
begin
  begin
    update matches set score_a = p_a, score_b = p_b where id = (select m from ids);
  exception when others then ok := true;
  end;
  return ok;
end $$;

-- fixture: o vôlei, um campeonato de limite 12 e uma partida já lançada
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

begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
create temp table ids as select
  (select group_id from ctx) as g,
  gen_random_uuid() as sess, gen_random_uuid() as draw, gen_random_uuid() as tour,
  gen_random_uuid() as ta, gen_random_uuid() as tb, gen_random_uuid() as m;

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
insert into matches (id, group_id, tournament_id, session_id, phase, team_a_id, team_b_id, score_a, score_b)
  select m, g, tour, sess, 'semifinal', ta, tb, 12, 7 from ids;
commit;

-- ===== 1. O PLACAR DE FIM DE JOGO ENTRA =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select assert(not recusa_insert(12, 10), '12 × 10 com limite 12 é o fim do jogo');
select assert(not recusa_insert(12, 0),  '12 × 0 também');
select assert(not recusa_insert(10, 12), 'e de qualquer um dos dois lados');
commit;

-- ===== 2. NO LIMITE, UM PONTO DE DIFERENÇA NÃO ACABA =====
-- Em 11 × 11 o jogo continua: 12 × 11 é um placar que não existiu.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select assert(recusa_insert(12, 11), '12 × 11 é recusado');
select assert(recusa_insert(11, 12), 'dos dois lados');
commit;

-- ===== 3. ACIMA DO LIMITE SÓ EXISTE EMPURRANDO O EMPATE =====
-- Passado o limite, o jogo para no instante em que alguém abre dois.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select assert(not recusa_insert(13, 11), '13 × 11 existe: veio do 11 × 11');
select assert(not recusa_insert(14, 12), '14 × 12 também');
select assert(not recusa_insert(18, 16), 'e não há teto para o empurrado');
select assert(recusa_insert(13, 9),  '13 × 9 não: o jogo teria acabado em 12 × 9');
select assert(recusa_insert(14, 11), '14 × 11 não: teria acabado em 13 × 11');
select assert(recusa_insert(18, 3),  '18 × 3 não');
commit;

-- ===== 4. JOGO INTERROMPIDO CONTINUA ENTRANDO =====
-- Acabou o horário da quadra, começou a chover: o jogo para em 7 × 5 e isso
-- aconteceu de verdade. Na tela é pergunta; aqui é silêncio, porque o banco não
-- tem como perguntar nada a ninguém.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select assert(not recusa_insert(7, 5),  '7 × 5 entra: jogo interrompido');
select assert(not recusa_insert(10, 9), 'mesmo sem os dois de diferença');
commit;

-- ===== 5. A CORREÇÃO PASSA PELA MESMA RÉGUA =====
-- Era por aqui que o placar impossível entrava sem passar pela folha: UPDATE
-- direto numa partida já lançada.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select assert(recusa_update(12, 11), 'corrigir para 12 × 11 é recusado');
select assert(recusa_update(18, 3),  'corrigir para 18 × 3 também');
select assert(
  (select score_a || ' x ' || score_b from matches where id = (select m from ids)) = '12 x 7',
  'e o placar bom continua lá');
select assert(not recusa_update(13, 11), 'corrigir para um placar válido passa');
commit;

-- ===== 6. E PELA FUNÇÃO DE CORREÇÃO TAMBÉM =====
-- `correct_match_score` é `security definer`: ela escreve por dentro. Se o
-- trigger não valesse ali, a porta de corrigir seria a porta do placar errado.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare ok boolean := false;
begin
  begin
    perform correct_match_score((select m from ids), 18, 3);
  exception when others then ok := true;
  end;
  perform assert(ok, 'correct_match_score recusa 18 × 3');
end $$;
select assert(
  (select score_a || ' x ' || score_b from matches where id = (select m from ids)) = '13 x 11',
  'o placar não mudou');
commit;

-- ===== 7. CADA CAMPEONATO TEM O SEU LIMITE =====
-- A regra lê `tournaments.point_limit`, não um 12 cravado.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update tournaments set point_limit = 15 where id = (select tour from ids);
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select assert(not recusa_insert(15, 13), 'com limite 15, 15 × 13 acaba o jogo');
select assert(recusa_insert(15, 14), 'e 15 × 14 não');
select assert(not recusa_insert(12, 10), '12 × 10 virou jogo interrompido');
commit;
