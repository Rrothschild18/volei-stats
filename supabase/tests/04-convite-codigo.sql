-- =============================================================================
-- O código do convite: o que a pessoa digita em vez de clicar.
-- =============================================================================
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),  -- dono
  ('22222222-2222-2222-2222-222222222222'),  -- digita o codigo certo
  ('33333333-3333-3333-3333-333333333333'),  -- digita com caixa trocada
  ('44444444-4444-4444-4444-444444444444'),  -- tenta o codigo cancelado
  ('55555555-5555-5555-5555-555555555555'),  -- varre codigos e bate na trava
  ('66666666-6666-6666-6666-666666666666'),  -- dono de outro volei
  ('77777777-7777-7777-7777-777777777777');  -- usa o codigo escolhido

create or replace function assert(cond boolean, msg text)
returns void language plpgsql as $$
begin if not cond then raise exception 'FALHOU: %', msg; end if; end $$;

-- ===== 1. CRIAR UM VOLEI JA DEVOLVE O CODIGO =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
create temp table ctx as
  select * from create_group('Volei de Terca','Raul','M','1990-05-10','2000-01-01');
commit;

select assert((select invite_code from ctx) is not null, 'create_group devolveu o codigo');
select assert(length((select invite_code from ctx))=6, 'o codigo gerado tem 6 casas');
select assert((select invite_code from ctx) ~ '^[A-HJ-NP-Z2-9]{6}$',
  'o codigo gerado nao usa O/0 nem I/1');

-- Dois volies nunca nascem com o mesmo codigo.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
create temp table ctx2 as
  select * from create_group('Volei de Quinta','Be','F','1992-03-01','2000-01-01');
commit;
select assert((select invite_code from ctx) <> (select invite_code from ctx2),
  'cada volei nasce com o seu codigo');

-- ===== 2. DIGITAR O CODIGO ENTRA NO VOLEI =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select assert((select group_id from redeem_invite_code((select invite_code from ctx)))
  = (select group_id from ctx), 'o codigo levou ao volei certo');
select assert((select role from group_members where user_id=auth.uid())='viewer',
  'quem digita o codigo entra como espectador');
commit;

-- O codigo nao vaza identidade nenhuma: so da leitura, como o link.
select assert(
  (select player_id from group_members
    where user_id='22222222-2222-2222-2222-222222222222') is null,
  'o codigo nao diz quem a pessoa e');

-- ===== 3. CAIXA E ESPACO NAO IMPORTAM =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select assert(
  (select group_id from redeem_invite_code(
    '  ' || lower((select invite_code from ctx)) || ' ')) = (select group_id from ctx),
  'minuscula com espaco nas pontas entra igual');
commit;

-- ===== 4. O DONO TROCA PELO CODIGO ESCOLHIDO =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update invites set code = 'teste-volei' where group_id = (select group_id from ctx);
commit;

select assert((select code from invites where group_id=(select group_id from ctx))='TESTE-VOLEI',
  'o codigo escolhido fica guardado em maiusculas');

begin;
set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select assert((select group_id from redeem_invite_code('teste-volei'))=(select group_id from ctx),
  'o codigo escolhido entra');
commit;

-- Ninguem mais pode usar esse codigo.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
do $$ begin
  update invites set code = 'TESTE-VOLEI' where group_id = (select group_id from ctx2);
  raise exception 'FALHOU: dois volies com o mesmo codigo';
exception when unique_violation then null; end $$;
commit;

-- Formato: nada de espaco no meio, nada de codigo de duas casas.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
do $$ begin
  update invites set code = 'TESTE VOLEI' where group_id = (select group_id from ctx2);
  raise exception 'FALHOU: codigo com espaco no meio';
exception when check_violation then null; end $$;
do $$ begin
  update invites set code = 'AB' where group_id = (select group_id from ctx2);
  raise exception 'FALHOU: codigo de duas casas';
exception when check_violation then null; end $$;
commit;

-- ===== 5. CODIGO QUE NAO EXISTE NAO DIZ NADA =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
do $$ begin
  perform redeem_invite_code('ZZZZZZ');
  raise exception 'FALHOU: codigo inexistente funcionou';
exception when no_data_found then null; end $$;
commit;

-- ===== 6. CANCELAR O CONVITE TRANCA O CODIGO =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update invites set revoked_at = now() where group_id = (select group_id from ctx);
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
do $$ begin
  perform redeem_invite_code('TESTE-VOLEI');
  raise exception 'FALHOU: codigo cancelado ainda entra';
exception when raise_exception then null; end $$;
commit;

-- E o dono gera outro, com codigo novo.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
create temp table novo as
  with feito as (
    insert into invites (group_id, label) values ((select group_id from ctx), 'Link novo')
    returning code
  )
  select code from feito;
commit;

select assert((select code from novo) <> 'TESTE-VOLEI', 'o convite novo tem codigo proprio');

begin;
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select assert((select group_id from redeem_invite_code((select code from novo)))
  = (select group_id from ctx), 'o codigo novo entra');
commit;

-- ===== 7. VARRER CODIGOS PARA =====
-- Dez erros em 15 minutos e a sessao para de poder tentar — inclusive com um
-- codigo que existe. Nao e a defesa principal (sessao anonima nova e gratis),
-- mas barra o laço bobo.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
do $$
begin
  for i in 1..10 loop
    begin
      perform redeem_invite_code('ZZZZZ' || i);
    exception when others then null; end;
  end loop;
end $$;
do $$ begin
  perform redeem_invite_code((select code from novo));
  raise exception 'FALHOU: a trava de codigo nao pegou';
exception when raise_exception then null; end $$;
commit;

-- ===== 8. O CONVITE E SO DO DONO, E O MIOLO NAO E DE NINGUEM =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select assert((select count(*) from invites)=0, 'membro comum nao enxerga convite');
select assert((select count(*) from invite_redeem_attempts)=0,
  'ninguem le as tentativas de codigo');
do $$ begin
  perform accept_invite(null::invites);
  raise exception 'FALHOU: accept_invite chamavel pelo cliente';
exception when insufficient_privilege then null; end $$;
commit;

select 'OK 04' as resultado;
