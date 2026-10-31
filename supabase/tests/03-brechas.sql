-- =============================================================================
-- As brechas que a revisão de código achou, cada uma com o teste que faltava.
--
-- Todas eram reais e foram reproduzidas antes de fechar. Este arquivo existe
-- para elas não voltarem.
-- =============================================================================
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),  -- dono
  ('22222222-2222-2222-2222-222222222222'),  -- Vitoria
  ('33333333-3333-3333-3333-333333333333'),  -- Willy
  ('44444444-4444-4444-4444-444444444444'),  -- quem tenta se aproveitar
  ('55555555-5555-5555-5555-555555555555'),  -- sessão anônima descartável 1
  ('66666666-6666-6666-6666-666666666666'),  -- sessão anônima descartável 2
  ('77777777-7777-7777-7777-777777777777');  -- sessão anônima descartável 3

create or replace function assert(cond boolean, msg text)
returns void language plpgsql as $$
begin if not cond then raise exception 'FALHOU: %', msg; end if; end $$;

-- fixture: o vôlei, três amigos cadastrados com a data inicial
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
create temp table ctx as
  select * from create_group('Volei de Terca','Raul','M','1990-05-10','2000-01-01');
insert into players (group_id, name, gender, birth_date)
select group_id, n, g, '2000-01-01' from ctx, (values ('Vitoria','F'),('Willy','M'),('Be','F')) as v(n,g);
commit;

-- ===== 1. A SENHA DO GRUPO NAO SAI PELO RETORNO DA FUNCAO =====
-- `returns groups` levava initial_birth_date embora: privilegio de COLUNA nao
-- vale para os campos de um composto devolvido por security definer.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
create temp table entered as select * from redeem_invite((select invite_token from ctx));
select assert((select count(*) from entered)=1, 'redeem_invite devolveu o volei');
-- Duas colunas e so: id e nome. Nada de initial_birth_date vindo de carona.
select assert(
  (select count(*) from pg_attribute
   where attrelid = 'entered'::regclass and attnum > 0 and not attisdropped)=2,
  'redeem_invite devolve duas colunas');
select assert(
  not exists (select 1 from pg_attribute
              where attrelid = 'entered'::regclass and attname = 'initial_birth_date'),
  'a senha do grupo nao vem no retorno');
commit;

-- ===== 2. O UUID DO VOLEI NAO E UMA PORTA =====
-- enter_group era chamavel direto, com o uuid do grupo — que e permanente.
-- Enquanto fosse, revogar um convite nao trancava ninguem.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
do $$ begin
  perform enter_group((select group_id from ctx));
  raise exception 'FALHOU: enter_group chamavel pelo cliente';
exception when insufficient_privilege then null; end $$;
commit;

-- E revogar o convite tranca de verdade.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update invites set revoked_at = now() where group_id = (select group_id from ctx);
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
do $$ begin
  perform redeem_invite((select invite_token from ctx));
  raise exception 'FALHOU: convite revogado ainda entrou';
exception when raise_exception then null; end $$;
select assert((select count(*) from groups)=0,'e nao ve o volei');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update invites set revoked_at = null where group_id = (select group_id from ctx);
commit;

-- ===== 3. UM DIA TEM UMA SESSAO =====
-- my_groups usa subquery escalar em sessions. Dois jogadores abrindo a presenca
-- ao mesmo tempo criavam duas linhas, e a PRIMEIRA TELA do app passava a dar
-- erro 21000 para todos os membros do volei.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select assert((claim_player((select group_id from ctx),'Vitoria','2000-01-01','1995-07-02')).ok,
              'Vitoria entrou');
insert into sessions (group_id, date) values ((select group_id from ctx), current_date);
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin
  insert into sessions (group_id, date) values ((select group_id from ctx), current_date);
  raise exception 'FALHOU: duas sessoes no mesmo dia';
exception when unique_violation then null; end $$;
select assert((select count(*) from my_groups)=1,'a primeira tela continua de pe');
commit;

-- ===== 4. QUEM LANCOU E QUEM CORRIGIU SAO DO BANCO =====
-- Eram colunas comuns: qualquer jogador mudava o placar deixando corrected_by
-- nulo, e a justificativa de deixar todo mundo corrigir caia junto.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into draws (id, group_id, session_id, selected)
select 'd2a00000-0000-0000-0000-000000000001', group_id,
       (select id from sessions where group_id = ctx.group_id), true from ctx;
insert into tournaments (id, group_id, session_id, draw_id, name, format_id, point_limit)
select '7040000a-0000-0000-0000-000000000001', group_id,
       (select id from sessions where group_id = ctx.group_id),
       'd2a00000-0000-0000-0000-000000000001','Teste','knockout-2',12 from ctx;
insert into tournament_teams (id, group_id, tournament_id, position, player1_id, player2_id)
select '70e00000-0000-0000-0000-00000000000a', group_id,
       '7040000a-0000-0000-0000-000000000001', 1,
       (select id from players where group_id=ctx.group_id and name='Raul'),
       (select id from players where group_id=ctx.group_id and name='Vitoria') from ctx;
insert into tournament_teams (id, group_id, tournament_id, position, player1_id, player2_id)
select '70e00000-0000-0000-0000-00000000000b', group_id,
       '7040000a-0000-0000-0000-000000000001', 2,
       (select id from players where group_id=ctx.group_id and name='Willy'),
       (select id from players where group_id=ctx.group_id and name='Be') from ctx;

-- Mente no reported_by de propósito: o gatilho tem de sobrescrever.
insert into matches (group_id,tournament_id,session_id,phase,team_a_id,team_b_id,score_a,score_b,reported_by)
select group_id,'7040000a-0000-0000-0000-000000000001',
       (select id from sessions where group_id = ctx.group_id),
       'final','70e00000-0000-0000-0000-00000000000a','70e00000-0000-0000-0000-00000000000b',12,7,
       (select id from players where group_id=ctx.group_id and name='Willy') from ctx;

select assert(
  (select reported_by from matches) = (select id from players where name='Vitoria'),
  'quem lancou e quem estava na sessao, nao quem o cliente disse');
select assert((select corrected_by from matches) is null,'ninguem corrigiu ainda');
commit;

-- Willy corrige, e nao consegue nao assinar.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select redeem_invite((select invite_token from ctx));
select assert((claim_player((select group_id from ctx),'Willy','2000-01-01','1988-09-08')).ok,'Willy entrou');
update matches set score_a = 12, score_b = 9, corrected_by = null;
select assert(
  (select corrected_by from matches) = (select id from players where name='Willy'),
  'o banco assinou a correcao, mesmo com o cliente mandando nulo');
select assert((select corrected_at from matches) is not null,'e marcou quando');
commit;

-- Mexer em outra coluna nao inventa correcao.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
update matches set played_at = now();
select assert(
  (select corrected_by from matches) = (select id from players where name='Willy'),
  'quem corrigiu nao muda sozinho');
commit;

-- ===== 5. A SENHA NAO SE TROCA COM UM UPDATE COMUM =====
-- Era o jeito de trocar a senha de alguem por fora de reset_player_birth_date,
-- que existe para derrubar os aparelhos da vitima: ela ficaria logada sem saber.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin
  update players set birth_date = '1111-11-11' where name = 'Be';
  raise exception 'FALHOU: o dono trocou a senha de alguem na mao';
exception when insufficient_privilege then null; end $$;
do $$ begin
  update players set birth_date_changed = true where name = 'Be';
  raise exception 'FALHOU: o dono marcou a troca na mao';
exception when insufficient_privilege then null; end $$;
-- O que ele PODE: nome, sexo e ativo.
update players set name = 'Bea' where name = 'Be';
select assert((select count(*) from players where name='Bea')=1,'o dono ainda renomeia');
commit;

-- ===== 6. INATIVAR TIRA O ACESSO =====
-- A linha de group_members sobrevivia a inativacao, e claim_player deixava a
-- pessoa voltar com a propria data: quem saiu do volei seguia escrevendo.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update players set active = false where name = 'Willy';
commit;

select assert(
  (select count(*) from group_members
   where player_id = (select id from players where name='Willy'))=0,
  'os aparelhos de quem saiu viraram espectadores');

begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select assert((claim_player((select group_id from ctx),'Willy','1988-09-08')).reason = 'not_found',
              'quem saiu nao volta com a propria data');
do $$ begin
  insert into sessions (group_id, date) values ((select group_id from ctx), current_date - 1);
  raise exception 'FALHOU: quem saiu ainda escreve';
exception when insufficient_privilege then null; end $$;
commit;

-- ===== 7. A TRAVA DE FORCA BRUTA CONTA POR PESSOA TENTADA =====
-- Ela contava por auth.uid(), e uma sessao anonima nova e gratis — era a
-- propria porta de entrada do modelo. Entao o atacante zerava o contador a
-- cada 5 tentativas.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select redeem_invite((select invite_token from ctx));
do $$ declare i int;
begin
  for i in 1..5 loop
    perform claim_player((select group_id from ctx),'Bea','1970-01-01');
  end loop;
end $$;
commit;

-- Sessao nova, contador zerado — e a trava continua valendo para o nome "Bea".
begin;
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select redeem_invite((select invite_token from ctx));
select assert((claim_player((select group_id from ctx),'Bea','2000-01-01','1997-05-19')).reason
              = 'rate_limited',
              'sessao nova nao zera a trava do nome tentado');
commit;

-- E a trava e por NOME: outra pessoa do volei nao fica trancada junto.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
select redeem_invite((select invite_token from ctx));
select assert((claim_player((select group_id from ctx),'Vitoria','1995-07-02')).ok,
              'quem nao foi alvo entra normalmente');
commit;

-- ===== 8. PASSAR O VOLEI SO PARA QUEM JA ENTROU =====
-- Passar para um nome nao reivindicado deixava o volei sem dono efetivo, e
-- quem reivindicasse aquele nome com a data inicial assumia tudo.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin
  perform transfer_ownership((select group_id from ctx),
                             (select id from players where name='Bea'));
  raise exception 'FALHOU: passou o volei para um nome que ninguem reivindicou';
exception when invalid_parameter_value then null; end $$;
select assert(is_group_owner((select group_id from ctx)),'o dono continua dono');
commit;

-- Para quem ja entrou, passa.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select transfer_ownership((select group_id from ctx),
                          (select id from players where name='Vitoria'));
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select assert(is_group_owner((select group_id from ctx)),'Vitoria e a dona agora');
commit;

-- ===== 9. A DATA DO DONO NAO PODE SER A DATA INICIAL DO GRUPO =====
-- Se fossem iguais, o nome do dono ficaria reivindicavel com a senha que ele
-- mesmo manda no grupo.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
do $$ begin
  perform create_group('Outro Volei','Alguem','M','2000-01-01','2000-01-01');
  raise exception 'FALHOU: dono com a mesma data do grupo';
exception when invalid_parameter_value then null; end $$;
commit;

select 'TODAS AS BRECHAS ESTAO FECHADAS' as resultado;
