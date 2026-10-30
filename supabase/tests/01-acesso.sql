grant usage on schema public, auth to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public, auth to anon, authenticated;
grant select on auth.users to anon, authenticated;

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),  -- admin
  ('22222222-2222-2222-2222-222222222222'),  -- espectador
  ('33333333-3333-3333-3333-333333333333'),  -- jogador novo
  ('44444444-4444-4444-4444-444444444444'),  -- mesmo jogador, outro aparelho
  ('55555555-5555-5555-5555-555555555555'),  -- cadastro sem nascimento
  ('66666666-6666-6666-6666-666666666666'),  -- se reconhece por nome+nascimento
  ('77777777-7777-7777-7777-777777777777'),  -- erra e bate na trava
  ('88888888-8888-8888-8888-888888888888'),  -- tenta sem o link do grupo
  ('99999999-9999-9999-9999-999999999999');  -- segundo administrador

create or replace function assert(cond boolean, msg text)
returns void language plpgsql as $$
begin if not cond then raise exception 'FALHOU: %', msg; end if; end $$;

-- ===== 1. ADMIN CRIA O GRUPO =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
create temp table ctx as select * from create_group('Volei de Terca','Raul','M');
select assert((select count(*) from ctx)=1, 'create_group devolveu 1 linha');
select assert((select recovery_token from ctx) is not null, 'devolveu link de recuperacao');
commit;

-- ===== 2. QUEM NAO TEM LINK NAO VE NADA =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select assert((select count(*) from players)=0, 'sem link nao le jogadores');
select assert((select count(*) from groups)=0,  'sem link nao enxerga o grupo');
commit;

-- ===== 3. LINK DO GRUPO => ESPECTADOR LE =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select enter_group((select group_id from ctx));
select assert((select count(*) from players)=1, 'com link le jogadores');
commit;

-- ===== 4. ESPECTADOR NAO ESCREVE =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
begin
  insert into players (group_id, name, gender)
  values ((select group_id from ctx), 'Intruso', 'M');
  raise exception 'FALHOU: espectador conseguiu escrever';
exception when insufficient_privilege then null;
end $$;
commit;

-- ===== 5. ADMIN GERA CONVITE DE ENTRADA =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
create temp table inv1 as
  with novo as (
    insert into invites (group_id, grants_role, label)
    values ((select group_id from ctx), 'player', 'Entrada')
    returning token)
  select token from novo;
commit;

-- ===== 6. JOGADOR RESGATA, DIGITANDO NOME =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
create temp table m1 as select * from redeem_invite((select token from inv1), 'Vitoria', 'F', date '1995-03-14');
select assert((select role from m1)='player', 'virou jogador');
select assert((select player_id from m1) is not null, 'ficou ligado a um jogador');
select assert((select count(*) from players)=2, 'o jogador foi criado');
commit;

-- ===== 7. MESMO CONVITE NO SEGUNDO APARELHO => MESMO JOGADOR =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
create temp table m2 as select * from redeem_invite((select token from inv1), 'Vitoria', 'F', date '1995-03-14');
select assert((select player_id from m2)=(select player_id from m1), 'segundo aparelho, mesmo jogador');
select assert((select count(*) from players)=2, 'nao duplicou o jogador');
commit;

-- ===== 8. RE-ASSOCIACAO: ADMIN DEVOLVE O HISTORICO A QUEM SE PERDEU =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
create temp table inv2 as
  with novo as (
    insert into invites (group_id, player_id, grants_role, label)
    values ((select group_id from ctx), (select player_id from m1), 'player', 'Re-associacao')
    returning token)
  select token from novo;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
create temp table m3 as select * from redeem_invite((select token from inv2));
select assert((select player_id from m3)=(select player_id from m1), 're-associou ao mesmo jogador');
select assert((select count(*) from players)=2, 're-associacao nao cria jogador novo');
commit;

-- ===== 9. CONVITE REVOGADO NAO FUNCIONA =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update invites set revoked_at = now() where token=(select token from inv1);
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
begin
  perform redeem_invite((select token from inv1), 'Outro', 'M', date '1990-01-01');
  raise exception 'FALHOU: convite revogado funcionou';
exception when raise_exception then
  if position('cancelado' in sqlerrm)=0 then raise; end if;
end $$;
commit;

-- ===== 10. CONVITE NAO VAZA PARA NAO-ADMIN =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select assert((select count(*) from invites)=0, 'jogador nao enxerga convites');
commit;


-- ===== 11. NASCIMENTO E OBRIGATORIO NO CADASTRO =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
create temp table inv3 as
  with novo as (
    insert into invites (group_id, grants_role, label)
    values ((select group_id from ctx), 'player', 'Entrada 2')
    returning token)
  select token from novo;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
do $$
begin
  perform redeem_invite((select token from inv3), 'Willy', 'M');
  raise exception 'FALHOU: cadastrou sem data de nascimento';
exception when invalid_parameter_value then null;
end $$;
select assert((select count(*) from redeem_invite((select token from inv3),'Willy','M',date '1992-07-02'))=1,
              'cadastrou com nascimento');
commit;

-- ===== 12. RECONHECER-SE POR NOME + NASCIMENTO =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
select enter_group((select group_id from ctx));
create temp table c1 as select * from claim_player((select group_id from ctx),'Vitoria',date '1995-03-14');
select assert((select ok from c1),'reconheceu');
select assert((select player_id from c1)=(select player_id from m1),'reconheceu o jogador certo');
select assert((select role from group_members
               where user_id='66666666-6666-6666-6666-666666666666')='player','virou jogador');
commit;

-- ===== 13. DADO ERRADO NAO ENTRA, E NAO DIZ SE O NOME EXISTE =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select enter_group((select group_id from ctx));
create temp table c2 as select
  (claim_player((select group_id from ctx),'Vitoria',date '2000-01-01')).*;
create temp table c3 as select
  (claim_player((select group_id from ctx),'NaoExiste',date '2000-01-01')).*;
select assert(not (select ok from c2),'data errada nao entra');
select assert(not (select ok from c3),'nome inexistente nao entra');
select assert((select reason from c2)=(select reason from c3),
              'mesmo motivo: nao revela quem esta no grupo');
commit;

-- ===== 14. TRAVA DE FORCA BRUTA =====
-- 2 erros acima + 3 aqui = 5; a 6a tentativa e barrada mesmo estando CERTA
begin;
set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
do $$ declare i int;
begin
  for i in 1..3 loop
    perform claim_player((select group_id from ctx),'Vitoria',date '2001-01-01');
  end loop;
end $$;
create temp table c4 as select
  (claim_player((select group_id from ctx),'Vitoria',date '1995-03-14')).*;
select assert(not (select ok from c4),'a trava segurou mesmo com o dado certo');
select assert((select reason from c4)='rate_limited','parou pela trava, nao por outro motivo');
commit;

-- ===== 15. SEM O LINK DO GRUPO NAO DA NEM PARA TENTAR =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
do $$
begin
  perform claim_player((select group_id from ctx),'Vitoria',date '1995-03-14');
  raise exception 'FALHOU: tentou sem ser membro do grupo';
exception when insufficient_privilege then null;
end $$;
commit;


-- ===== 16. PODE HAVER MAIS DE UM ADMINISTRADOR =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
create temp table inv_adm as
  with novo as (
    insert into invites (group_id, grants_role, label)
    values ((select group_id from ctx), 'admin', 'Segundo administrador')
    returning token)
  select token from novo;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
select redeem_invite((select token from inv_adm), 'Willy2', 'M', date '1988-05-05');
select assert((select role from group_members
               where user_id='99999999-9999-9999-9999-999999999999')='admin','virou administrador');
-- e o segundo admin escreve de verdade
insert into players (group_id, name, gender, birth_date)
values ((select group_id from ctx),'Criado pelo 2o admin','M',date '1991-01-01');
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select assert((select count(*) from group_members
               where group_id=(select group_id from ctx) and role='admin')=2,'dois administradores');
commit;

-- ===== 17. O GRUPO NAO PODE FICAR SEM ADMINISTRADOR =====
-- com dois admins, rebaixar um e permitido
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update group_members set role='player'
 where group_id=(select group_id from ctx) and user_id='99999999-9999-9999-9999-999999999999';
select assert((select count(*) from group_members
               where group_id=(select group_id from ctx) and role='admin')=1,'sobrou um admin');
commit;
-- rebaixar o ULTIMO e barrado
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
begin
  update group_members set role='player'
   where group_id=(select group_id from ctx) and user_id='11111111-1111-1111-1111-111111111111';
  raise exception 'FALHOU: rebaixou o ultimo';
exception when raise_exception then
  if position('sem administrador' in sqlerrm)=0 then raise; end if;
end $$;
commit;
-- remover o ULTIMO tambem e barrado
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
begin
  delete from group_members
   where group_id=(select group_id from ctx) and user_id='11111111-1111-1111-1111-111111111111';
  raise exception 'FALHOU: apagou o ultimo';
exception when raise_exception then
  if position('sem administrador' in sqlerrm)=0 then raise; end if;
end $$;
commit;

-- ===== 18. A TRAVA NAO ATRAPALHA APAGAR O GRUPO =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
create temp table g2 as select * from create_group('Descartavel','Teste','M',date '1990-09-09');
select assert((select recovery_token from g2) is not null,'link de recuperacao gerado');
select assert((select expires_at from invites where token=(select recovery_token from g2)) is null,
              'link de recuperacao nao expira');
commit;
begin;
set local role postgres;
delete from groups where id=(select group_id from g2);
select assert((select count(*) from groups where id=(select group_id from g2))=0,'grupo apagado');
commit;

select 'TODOS OS TESTES DE ACESSO PASSARAM' as resultado;
