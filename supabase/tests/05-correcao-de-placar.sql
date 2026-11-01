-- =============================================================================
-- correct_match_score: corrigir um placar e levar junto o que ele derrubou.
--
-- O que esta suíte precisa provar é o que a função abre e o que ela NÃO abre.
-- Ela existe porque apagar partida é do dono e corrigir é de qualquer jogador;
-- se o alcance dela vazar, ela vira a porta lateral que o schema fechou.
-- =============================================================================
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),  -- Raul, dono
  ('22222222-2222-2222-2222-222222222222'),  -- Vitoria, jogadora
  ('33333333-3333-3333-3333-333333333333'),  -- Willy, jogador
  ('44444444-4444-4444-4444-444444444444'),  -- só membro: abriu o link, não disse quem é
  ('55555555-5555-5555-5555-555555555555');  -- de fora, outro vôlei

create or replace function assert(cond boolean, msg text)
returns void language plpgsql as $$
begin if not cond then raise exception 'FALHOU: %', msg; end if; end $$;

-- fixture: o vôlei e o pessoal
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
create temp table ctx as
  select * from create_group('Volei de Terca','Raul','M','1990-05-10','volei99');
select add_player((select group_id from ctx), n, g)
from (values ('Vitoria','F'),('Willy','M'),('Be','F'),('Duda','F'),('Leo','M')) as v(n,g);
commit;

-- Vitoria diz quem é: vira jogadora. Willy também.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select redeem_invite((select invite_token from ctx));
select claim_player((select group_id from ctx), 'Vitoria', 'volei99', '1990-05-10');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select redeem_invite((select invite_token from ctx));
select claim_player((select group_id from ctx), 'Willy', 'volei99', '1990-05-10');
commit;

-- Quem só abriu o link é MEMBRO, e não jogador: lê tudo, não escreve nada.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select redeem_invite((select invite_token from ctx));
commit;

-- Um campeonato de seis duplas... na verdade três duplas e uma chave curta:
-- rodada 1 com uma partida, uma final, e uma dupla sintética para o encaixe.
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
  gen_random_uuid() as enc,
  gen_random_uuid() as m_round1,
  gen_random_uuid() as m_final;

insert into sessions (id, group_id, date) select sess, g, current_date from ids;
insert into draws (id, group_id, session_id) select draw, g, sess from ids;
insert into tournaments (id, group_id, session_id, draw_id, name, format_id, point_limit)
  select tour, g, sess, draw, 'Teste', 'knockout-6', 12 from ids;

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
-- A dupla do encaixe: sintética, nascida de um par-ou-ímpar.
insert into tournament_teams
  (id, group_id, tournament_id, position, player1_id, player2_id, synthetic)
  select enc, g, tour, 4,
    (select id from players where group_id = ids.g and name = 'Vitoria'),
    (select id from players where group_id = ids.g and name = 'Leo'), true from ids;

insert into matches (id, group_id, tournament_id, session_id, phase, team_a_id, team_b_id, score_a, score_b)
  select m_round1, g, tour, sess, 'round-1', ta, tb, 12, 9 from ids;
insert into matches (id, group_id, tournament_id, session_id, phase, team_a_id, team_b_id, score_a, score_b, played_at)
  select m_final, g, tour, sess, 'final', ta, tc, 12, 7, now() from ids;
commit;

-- ===== 1. A JOGADORA CORRIGE, E A FASE POSTERIOR SAI JUNTO =====
-- É o caso inteiro do ticket 35: a rodada 1 muda, e a final que já não acontece
-- não pode ficar contando no saldo e nos rankings.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select correct_match_score(
  (select m_round1 from ids), 9, 12,
  array[(select m_final from ids)]
);
select assert(
  (select score_b from matches where id = (select m_round1 from ids)) = 12,
  'a jogadora corrigiu o placar da rodada 1');
select assert(
  (select count(*) from matches where id = (select m_final from ids)) = 0,
  'a final que o resultado novo não produz mais FOI APAGADA');
-- E o autor da correção é gravado pelo banco, não pelo cliente.
select assert(
  (select corrected_by from matches where id = (select m_round1 from ids))
    = (select id from players where group_id = (select g from ids) and name = 'Vitoria'),
  'quem corrigiu ficou registrado');
commit;

-- devolve o estado para os testes seguintes
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update matches set score_a = 12, score_b = 9 where id = (select m_round1 from ids);
insert into matches (id, group_id, tournament_id, session_id, phase, team_a_id, team_b_id, score_a, score_b, played_at)
  select m_final, g, tour, sess, 'final', ta, tc, 12, 7, now() from ids;
commit;

-- ===== 2. O ALCANCE NÃO VAZA: A RODADA 1 NÃO É APAGÁVEL =====
-- Sem esta trava, a função seria um delete de partida com outro nome.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare ok boolean := false;
begin
  begin
    perform correct_match_score(
      (select m_final from ids), 12, 8,
      array[(select m_round1 from ids)]
    );
  exception when others then ok := true;
  end;
  perform assert(ok, 'apagar a rodada 1 pela correção é recusado');
end $$;
select assert(
  (select count(*) from matches where id = (select m_round1 from ids)) = 1,
  'a partida da rodada 1 continua lá');
commit;

-- ===== 3. NEM PARTIDA DE OUTRO CAMPEONATO =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
create temp table outro as select
  gen_random_uuid() as tour, gen_random_uuid() as ta, gen_random_uuid() as tb,
  gen_random_uuid() as m;
insert into tournaments (id, group_id, session_id, draw_id, name, format_id, point_limit)
  select outro.tour, ids.g, ids.sess, ids.draw, 'Outro', 'knockout-4', 12 from ids, outro;
insert into tournament_teams (id, group_id, tournament_id, position, player1_id, player2_id)
  select outro.ta, ids.g, outro.tour, 1,
    (select id from players where group_id = ids.g and name = 'Raul'),
    (select id from players where group_id = ids.g and name = 'Be') from ids, outro;
insert into tournament_teams (id, group_id, tournament_id, position, player1_id, player2_id)
  select outro.tb, ids.g, outro.tour, 2,
    (select id from players where group_id = ids.g and name = 'Duda'),
    (select id from players where group_id = ids.g and name = 'Willy') from ids, outro;
insert into matches (id, group_id, tournament_id, session_id, phase, team_a_id, team_b_id, score_a, score_b)
  select outro.m, ids.g, outro.tour, ids.sess, 'semifinal', outro.ta, outro.tb, 12, 4 from ids, outro;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare ok boolean := false;
begin
  begin
    perform correct_match_score(
      (select m_round1 from ids), 12, 10,
      array[(select m from outro)]
    );
  exception when others then ok := true;
  end;
  perform assert(ok, 'apagar partida de OUTRO campeonato é recusado');
end $$;
select assert(
  (select count(*) from matches where id = (select m from outro)) = 1,
  'a partida do outro campeonato continua lá');
commit;

-- ===== 4. SÓ A DUPLA DO ENCAIXE É DESFEITA =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare ok boolean := false;
begin
  begin
    -- `tc` é dupla do sorteio, não a sintética: desfazê-la levaria as partidas
    -- dela por cascata, que é exatamente a porta lateral que o schema fechou.
    perform correct_match_score(
      (select m_round1 from ids), 12, 10, '{}', (select tc from ids)
    );
  exception when others then ok := true;
  end;
  perform assert(ok, 'desfazer dupla do sorteio é recusado');
end $$;
select assert(
  (select count(*) from tournament_teams where id = (select tc from ids)) = 1,
  'a dupla do sorteio continua lá');

-- A sintética, sim.
select correct_match_score(
  (select m_round1 from ids), 12, 10, '{}', (select enc from ids)
);
select assert(
  (select count(*) from tournament_teams where id = (select enc from ids)) = 0,
  'a dupla do encaixe foi desfeita');
commit;

-- ===== 5. QUEM NÃO JOGA NÃO CORRIGE =====
-- Nem quem só abriu o link deste vôlei, nem quem é de fora.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
do $$
declare ok boolean := false;
begin
  begin
    perform correct_match_score((select m_round1 from ids), 1, 12);
  exception when others then ok := true;
  end;
  perform assert(ok, 'quem só é membro não corrige placar');
end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
do $$
declare ok boolean := false;
begin
  begin
    perform correct_match_score((select m_round1 from ids), 1, 12);
  exception when others then ok := true;
  end;
  perform assert(ok, 'quem é de fora não corrige placar');
end $$;
select assert(
  (select score_b from matches where id = (select m_round1 from ids)) = 10,
  'o placar continua o que a última correção válida deixou');
commit;

-- ===== 6. O PRAZO VALE NO BANCO, NÃO SÓ NA TELA =====
-- É a porta que a aba aberta desde ontem e o link antigo atravessam.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update matches set played_at = now() - interval '31 minutes'
where id = (select m_final from ids);
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare ok boolean := false;
begin
  begin
    perform correct_match_score((select m_round1 from ids), 1, 12);
  exception when others then ok := true;
  end;
  perform assert(ok, '31 min depois do fim, o banco recusa a correção');
end $$;
select assert(
  (select score_b from matches where id = (select m_round1 from ids)) = 10,
  'e nada foi gravado');
commit;

-- Dentro do prazo, passa.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update matches set played_at = now() - interval '29 minutes'
where id = (select m_final from ids);
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select correct_match_score((select m_round1 from ids), 12, 4);
select assert(
  (select score_b from matches where id = (select m_round1 from ids)) = 4,
  '29 min depois do fim ainda dá para corrigir');
commit;

-- Sem final lançada, corrigir vale sem prazo: o campeonato está rolando.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
delete from matches where id = (select m_final from ids);
update tournaments set created_at = now() - interval '30 days' where id = (select tour from ids);
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select correct_match_score((select m_round1 from ids), 12, 6);
select assert(
  (select score_b from matches where id = (select m_round1 from ids)) = 6,
  'sem final, corrigir vale sem prazo');
commit;

-- ===== 7. PARTIDA QUE NÃO EXISTE =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare ok boolean := false;
begin
  begin
    perform correct_match_score(gen_random_uuid(), 12, 6);
  exception when others then ok := true;
  end;
  perform assert(ok, 'corrigir partida inexistente é recusado');
end $$;
commit;


-- ===== 8. A PARTIDA CORRIGIDA NÃO SE APAGA =====
-- Num formato de duas duplas a rodada inicial É a final: se o cliente errar a
-- conta, o pedido chega aqui mandando apagar o próprio placar que acabou de
-- consertar. A trava não depende de conhecer formato.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare ok boolean := false;
begin
  begin
    perform correct_match_score(
      (select m_round1 from ids), 12, 3,
      array[(select m_round1 from ids)]
    );
  exception when others then ok := true;
  end;
  perform assert(ok, 'apagar a própria partida corrigida é recusado');
end $$;
select assert(
  (select count(*) from matches where id = (select m_round1 from ids)) = 1,
  'a partida corrigida continua lá');
commit;

select 'OK 05-correcao-de-placar' as resultado;
