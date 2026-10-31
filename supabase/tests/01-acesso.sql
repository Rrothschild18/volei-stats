-- =============================================================================
-- O modelo de acesso: dono, link, e a data como senha.
--
-- Cada bloco é um cenário contado na ordem em que acontece na vida real:
-- o dono cria o vôlei, cadastra os amigos, manda o link, cada um diz quem é.
-- =============================================================================
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),  -- dono
  ('22222222-2222-2222-2222-222222222222'),  -- abriu o link, nao disse quem e
  ('33333333-3333-3333-3333-333333333333'),  -- Vitoria, primeiro aparelho
  ('44444444-4444-4444-4444-444444444444'),  -- Vitoria, segundo aparelho
  ('55555555-5555-5555-5555-555555555555'),  -- erra a data e bate na trava
  ('66666666-6666-6666-6666-666666666666'),  -- tenta sem o link do volei
  ('77777777-7777-7777-7777-777777777777'),  -- Willy, que vai receber o volei
  ('88888888-8888-8888-8888-888888888888');  -- dono num navegador novo

create or replace function assert(cond boolean, msg text)
returns void language plpgsql as $$
begin if not cond then raise exception 'FALHOU: %', msg; end if; end $$;

-- ===== 1. QUALQUER UM CRIA UM VOLEI, E E DONO DELE =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
create temp table ctx as
  select * from create_group('Volei de Terca','Raul','M','1990-05-10','2000-01-01');
select assert((select count(*) from ctx)=1, 'create_group devolveu 1 linha');
select assert((select invite_token from ctx) is not null, 'devolveu o link do volei');
commit;

-- O dono ja entra com a data DELE, nao com a inicial do grupo: o nome dele
-- nunca fica na lista de nomes por reivindicar.
select assert((select birth_date from players where name='Raul')='1990-05-10','dono com a data dele');
select assert((select birth_date_changed from players where name='Raul'),'dono nao precisa trocar');
select assert(
  (select owner_player_id from groups where id=(select group_id from ctx))
  = (select player_id from ctx), 'owner_player_id aponta para quem criou');

-- ===== 2. O DONO CADASTRA OS AMIGOS COM A DATA INICIAL =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into players (group_id, name, gender, birth_date)
select group_id, n, g, '2000-01-01' from ctx, (values ('Vitoria','F'),('Willy','M'),('Be','F')) as v(n,g);
select assert((select count(*) from players where group_id=(select group_id from ctx))=4,'4 jogadores');
commit;

-- ===== 3. QUEM NAO TEM LINK NAO VE NADA =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select assert((select count(*) from groups)=0,'sem link nao ve o volei');
select assert((select count(*) from players)=0,'sem link nao ve jogadores');
commit;

-- ===== 4. O LINK DO VOLEI DA LEITURA, E SO =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select redeem_invite((select invite_token from ctx));
select assert((select count(*) from groups)=1,'depois do link, le o volei');
select assert((select role from group_members where user_id=auth.uid())='viewer','entrou como espectador');
commit;

-- Espectador nao escreve o jogo: ainda nao disse quem e.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$ begin
  insert into sessions (group_id, date) values ((select group_id from ctx), current_date);
  raise exception 'FALHOU: espectador criou sessao';
exception when insufficient_privilege then null; end $$;
commit;

-- ===== 5. A LISTA DE NOMES MOSTRA SO QUEM FALTA =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select assert((select count(*) from unclaimed_players((select group_id from ctx)))=3,'3 nomes por reivindicar');
select assert(not exists (select 1 from unclaimed_players((select group_id from ctx)) where name='Raul'),'o dono nao esta na lista');
commit;

-- ===== 6. A SENHA INICIAL NAO SERVE SEM TROCAR =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select redeem_invite((select invite_token from ctx));
select assert(
  (claim_player((select group_id from ctx),'Vitoria','2000-01-01')).reason = 'new_birth_date_required',
  'primeira entrada exige a data nova');
select assert((select role from group_members where user_id=auth.uid())='viewer','continua espectador');
commit;

-- E a data nova nao pode ser a propria inicial.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select assert(
  (claim_player((select group_id from ctx),'Vitoria','2000-01-01','2000-01-01')).reason
  = 'new_birth_date_must_differ', 'a data nova tem de ser outra');
commit;

-- ===== 7. REIVINDICAR O NOME, TROCANDO A DATA =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select assert((claim_player((select group_id from ctx),'Vitoria','2000-01-01','1995-07-02')).ok,
              'entrou trocando a data');
select assert((select role from group_members where user_id=auth.uid())='player','virou jogadora');
commit;

select assert((select birth_date from players where name='Vitoria')='1995-07-02','a data trocou');
select assert((select birth_date_changed from players where name='Vitoria'),'marcou que trocou');
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select redeem_invite((select invite_token from ctx));
select assert(not exists (select 1 from unclaimed_players((select group_id from ctx)) where name='Vitoria'),
              'saiu da lista de nomes');
commit;

-- ===== 8. JOGADORA FAZ O JOGO INTEIRO =====
-- E a razao de ser do modelo: o dono pode estar jogando a final.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
insert into sessions (id, group_id, date)
values ('5e550000-0000-0000-0000-000000000001',(select group_id from ctx), current_date);
insert into draws (id, group_id, session_id, selected)
values ('d2a00000-0000-0000-0000-000000000001',(select group_id from ctx),'5e550000-0000-0000-0000-000000000001',true);
insert into tournaments (id, group_id, session_id, draw_id, name, format_id, point_limit)
values ('7040000a-0000-0000-0000-000000000001',(select group_id from ctx),
        '5e550000-0000-0000-0000-000000000001','d2a00000-0000-0000-0000-000000000001','Teste','knockout-2',12);
select assert((select count(*) from tournaments)=1,'jogadora criou campeonato');
commit;

-- ===== 9. JOGADORA NAO MEXE EM QUEM EXISTE NEM APAGA =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$ begin
  insert into players (group_id,name,gender,birth_date)
  values ((select group_id from ctx),'Intruso','M','2000-01-01');
  raise exception 'FALHOU: jogadora cadastrou jogador';
exception when insufficient_privilege then null; end $$;

-- Apagar e do dono. O delete sem permissao nao estoura: nao casa linha.
delete from tournaments where id='7040000a-0000-0000-0000-000000000001';
select assert((select count(*) from tournaments)=1,'jogadora nao apagou o campeonato');
commit;

-- ===== 10. O DONO APAGA =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select redeem_invite((select invite_token from ctx));
delete from tournaments where id='7040000a-0000-0000-0000-000000000001';
select assert((select count(*) from tournaments)=0,'o dono apagou');
commit;

-- ===== 11. SEGUNDO APARELHO: NOME + A DATA NOVA =====
-- O nome saiu da lista, entao e por aqui que o tablet entra.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select redeem_invite((select invite_token from ctx));
select assert((claim_player((select group_id from ctx),'Vitoria','1995-07-02')).ok,
              'segundo aparelho entrou com a data dela');
commit;

select assert(
  (select count(distinct player_id) from group_members
   where user_id in ('33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444'))=1,
  'os dois aparelhos sao a mesma jogadora');

-- ===== 12. A DATA E SENHA: NAO SAI DO SERVIDOR =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$ begin
  perform birth_date from players limit 1;
  raise exception 'FALHOU: o cliente leu a data de nascimento';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform initial_birth_date from groups limit 1;
  raise exception 'FALHOU: o cliente leu a data inicial do grupo';
exception when insufficient_privilege then null; end $$;
-- `select *` continua funcionando: devolve as colunas permitidas.
select assert((select count(*) from players)=4,'select * ainda le os jogadores');
commit;

-- ===== 13. DATA ERRADA NAO ENTRA, E NAO DIZ SE O NOME EXISTE =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select redeem_invite((select invite_token from ctx));
select assert((claim_player((select group_id from ctx),'Be','1980-01-01')).reason='not_found',
              'data errada nao entra');
select assert((claim_player((select group_id from ctx),'Ninguem','1980-01-01')).reason='not_found',
              'nome inexistente da a MESMA resposta');
commit;

-- ===== 14. TRAVA DE FORCA BRUTA =====
-- 2 erros acima + 3 aqui = 5; a 6a tentativa e barrada mesmo estando CERTA.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
do $$ declare i int;
begin
  for i in 1..3 loop
    perform claim_player((select group_id from ctx),'Be','1970-01-01');
  end loop;
end $$;
select assert((claim_player((select group_id from ctx),'Be','2000-01-01','1998-03-03')).reason='rate_limited',
              'travou na 6a tentativa, mesmo com a data certa');
commit;

-- ===== 15. SEM O LINK DO VOLEI NAO DA NEM PARA TENTAR =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
do $$ begin
  perform claim_player((select group_id from ctx),'Be','2000-01-01','1998-03-03');
  raise exception 'FALHOU: tentou sem o link do volei';
exception when insufficient_privilege then null; end $$;
commit;

-- ===== 16. O DONO RESETA A DATA DE QUEM TRAVOU =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select reset_player_birth_date((select id from players where name='Vitoria'));
commit;

select assert((select birth_date from players where name='Vitoria')='2000-01-01','voltou para a data inicial');
select assert(not (select birth_date_changed from players where name='Vitoria'),'vai ter de trocar de novo');
select assert((select count(*) from group_members
               where player_id=(select id from players where name='Vitoria'))=0,
              'os aparelhos dela voltaram a ser espectadores');
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select assert(exists (select 1 from unclaimed_players((select group_id from ctx)) where name='Vitoria'),
              'o nome volta para a lista');
commit;

-- E ela entra de novo, trocando outra vez.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select assert((claim_player((select group_id from ctx),'Vitoria','2000-01-01','1995-07-02')).ok,
              'entrou de novo depois do reset');
commit;

-- Jogador nao reseta a data de ninguem.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$ begin
  perform reset_player_birth_date((select id from players where name='Be'));
  raise exception 'FALHOU: jogadora resetou a data de outra pessoa';
exception when insufficient_privilege then null; end $$;
commit;

-- ===== 17. A PROPRIEDADE ACOMPANHA O JOGADOR, NAO O NAVEGADOR =====
-- E o que faz perder o celular nao ser perder o volei.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
select redeem_invite((select invite_token from ctx));
select assert((claim_player((select group_id from ctx),'Raul','1990-05-10')).ok,
              'o dono se reconheceu num navegador novo');
select assert(is_group_owner((select group_id from ctx)),'e voltou a ser dono');
commit;

-- ===== 18. PASSAR O VOLEI PARA OUTRA PESSOA =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select redeem_invite((select invite_token from ctx));
select assert((claim_player((select group_id from ctx),'Willy','2000-01-01','1988-09-08')).ok,'Willy entrou');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select transfer_ownership((select group_id from ctx),(select id from players where name='Willy'));
select assert(not is_group_owner((select group_id from ctx)),'quem passou deixou de ser dono');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select assert(is_group_owner((select group_id from ctx)),'Willy e o dono agora');
-- E manda de verdade: cadastra jogador.
insert into players (group_id,name,gender,birth_date)
values ((select group_id from ctx),'Novato','M','2000-01-01');
commit;

-- Quem nao e dono nao passa o volei.
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin
  perform transfer_ownership((select group_id from ctx),(select id from players where name='Be'));
  raise exception 'FALHOU: ex-dono passou o volei';
exception when insufficient_privilege then null; end $$;
commit;

-- ===== 19. O VOLEI NUNCA FICA SEM DONO =====
do $$ begin
  update players set active=false where name='Willy';
  raise exception 'FALHOU: inativou o dono';
exception when raise_exception then null; end $$;

do $$ begin
  delete from players where name='Willy';
  raise exception 'FALHOU: apagou o dono';
exception when foreign_key_violation then null; end $$;

-- ===== 20. CONVITE REVOGADO NAO FUNCIONA, E NAO VAZA =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
update invites set revoked_at=now() where group_id=(select group_id from ctx);
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
do $$ begin
  perform redeem_invite((select invite_token from ctx));
  raise exception 'FALHOU: convite revogado funcionou';
exception when raise_exception then null; end $$;
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select assert((select count(*) from invites)=0,'convite nao vaza para quem nao e dono');
commit;

-- ===== 21. A PRIMEIRA TELA: SEUS VOLEIS =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select assert((select count(*) from my_groups)=1,'Vitoria ve 1 volei');
select assert((select role from my_groups)='player','com o papel dela');
select assert(not (select is_owner from my_groups),'e nao e dona');
select assert((select player_count from my_groups)=5,'com o tamanho do grupo');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select assert((select is_owner from my_groups),'Willy ve que e dono');
commit;

select 'TODOS OS TESTES DE ACESSO PASSARAM' as resultado;
