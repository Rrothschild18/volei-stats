grant usage on schema public, auth to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public, auth to anon, authenticated;
grant select on auth.users to anon, authenticated;

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),  -- admin
  ('22222222-2222-2222-2222-222222222222'),  -- espectador
  ('33333333-3333-3333-3333-333333333333'),  -- jogador novo
  ('44444444-4444-4444-4444-444444444444');  -- mesmo jogador, outro aparelho

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
create temp table m1 as select * from redeem_invite((select token from inv1), 'Vitoria', 'F');
select assert((select role from m1)='player', 'virou jogador');
select assert((select player_id from m1) is not null, 'ficou ligado a um jogador');
select assert((select count(*) from players)=2, 'o jogador foi criado');
commit;

-- ===== 7. MESMO CONVITE NO SEGUNDO APARELHO => MESMO JOGADOR =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
create temp table m2 as select * from redeem_invite((select token from inv1), 'Vitoria', 'F');
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
  perform redeem_invite((select token from inv1), 'Outro', 'M');
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

select 'TODOS OS TESTES DE ACESSO PASSARAM' as resultado;
