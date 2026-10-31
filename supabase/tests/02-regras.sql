create or replace function assert(cond boolean, msg text)
returns void language plpgsql as $$
begin if not cond then raise exception 'FALHOU: %', msg; end if; end $$;

-- fixture: 1 grupo, 4 jogadores, 1 sessao, 1 sorteio, 1 campeonato
insert into groups (id, name, initial_birth_date) values
 ('aaaaaaaa-0000-0000-0000-000000000001','Terca','2000-01-01'),
 ('bbbbbbbb-0000-0000-0000-000000000002','Quinta','2000-01-01');
insert into players (id, group_id, name, gender, birth_date) values
 ('0a000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','Raul','M','1990-05-10'),
 ('0b000000-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000001','Vitoria','F','1995-07-02'),
 ('0c000000-0000-0000-0000-00000000000c','aaaaaaaa-0000-0000-0000-000000000001','Willy','M','1988-09-08'),
 ('0d000000-0000-0000-0000-00000000000d','aaaaaaaa-0000-0000-0000-000000000001','Be','F','1997-05-19'),
 ('0e000000-0000-0000-0000-00000000000e','bbbbbbbb-0000-0000-0000-000000000002','Outro','M','1991-01-01');
insert into sessions (id, group_id, date) values
 ('5e550000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001', current_date);
insert into draws (id, group_id, session_id, selected)
values ('d2a00000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
        '5e550000-0000-0000-0000-000000000001', true);
insert into tournaments (id, group_id, session_id, draw_id, name, format_id, point_limit)
values ('7040000a-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
        '5e550000-0000-0000-0000-000000000001','d2a00000-0000-0000-0000-000000000001',
        'Teste','knockout-2',12);
insert into tournament_teams (id, group_id, tournament_id, position, player1_id, player2_id) values
 ('70e00000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001',1,'0a000000-0000-0000-0000-00000000000a','0b000000-0000-0000-0000-00000000000b'),
 ('70e00000-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001',2,'0c000000-0000-0000-0000-00000000000c','0d000000-0000-0000-0000-00000000000d');

-- ===== REGRAS DE PLACAR VIRAM CONSTRAINT =====
do $$ begin
  insert into matches (group_id,tournament_id,session_id,phase,team_a_id,team_b_id,score_a,score_b)
  values ('aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001','final','70e00000-0000-0000-0000-00000000000a','70e00000-0000-0000-0000-00000000000b',12,12);
  raise exception 'FALHOU: aceitou empate';
exception when check_violation then null; end $$;

do $$ begin
  insert into matches (group_id,tournament_id,session_id,phase,team_a_id,team_b_id,score_a,score_b)
  values ('aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001','final','70e00000-0000-0000-0000-00000000000a','70e00000-0000-0000-0000-00000000000b',0,0);
  raise exception 'FALHOU: aceitou 0 x 0';
exception when check_violation then null; end $$;

do $$ begin
  insert into tournament_teams (group_id,tournament_id,position,player1_id,player2_id)
  values ('aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001',9,'0a000000-0000-0000-0000-00000000000a','0a000000-0000-0000-0000-00000000000a');
  raise exception 'FALHOU: dupla com jogador repetido';
exception when check_violation then null; end $$;

-- ===== ISOLAMENTO ENTRE GRUPOS =====
do $$ begin
  insert into tournament_teams (group_id,tournament_id,position,player1_id,player2_id)
  values ('aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001',8,'0a000000-0000-0000-0000-00000000000a','0e000000-0000-0000-0000-00000000000e');
  raise exception 'FALHOU: misturou jogador de outro grupo';
exception when foreign_key_violation then null; end $$;

-- ===== NOME UNICO POR GRUPO, NAO GLOBAL =====
do $$ begin
  insert into players (group_id,name,gender,birth_date) values ('aaaaaaaa-0000-0000-0000-000000000001','raul','M','2000-01-01');
  raise exception 'FALHOU: aceitou nome repetido no grupo';
exception when unique_violation then null; end $$;
insert into players (group_id,name,gender,birth_date) values ('bbbbbbbb-0000-0000-0000-000000000002','Raul','M','1990-05-10');
select assert((select count(*) from players where lower(name)='raul')=2,'mesmo nome em grupos diferentes e permitido');

-- ===== COLUNAS GERADAS =====
insert into matches (group_id,tournament_id,session_id,phase,team_a_id,team_b_id,score_a,score_b)
values ('aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001','final','70e00000-0000-0000-0000-00000000000a','70e00000-0000-0000-0000-00000000000b',12,7);
select assert((select winner_id from matches)='70e00000-0000-0000-0000-00000000000a','vencedor gerado certo');
select assert((select loser_id  from matches)='70e00000-0000-0000-0000-00000000000b','perdedor gerado certo');
select assert((select point_difference from matches)=5,'diferenca gerada certa');

do $$ begin
  insert into matches (group_id,tournament_id,session_id,phase,team_a_id,team_b_id,score_a,score_b)
  values ('aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001','final','70e00000-0000-0000-0000-00000000000a','70e00000-0000-0000-0000-00000000000b',15,3);
  raise exception 'FALHOU: aceitou a mesma partida duas vezes';
exception when unique_violation then null; end $$;

-- ===== VIEWS =====
select assert((select wins from player_stats where player_id='0a000000-0000-0000-0000-00000000000a')=1,'vitoria contada');
select assert((select losses from player_stats where player_id='0c000000-0000-0000-0000-00000000000c')=1,'derrota contada');
select assert((select win_percentage from player_stats where player_id='0a000000-0000-0000-0000-00000000000a')=100,'aproveitamento');
select assert((select games_played from team_stats where player1_id='0a000000-0000-0000-0000-00000000000a')=1,'jogos da dupla');

-- ===== §7.6: ESPERA NAO PODE CONTAR EM TRIPLO =====
-- 3 propostas salvas do mesmo sorteio, so 1 escolhida, mesmo jogador em espera
insert into draws (group_id,session_id,waiting_player_id,selected) values
 ('aaaaaaaa-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001','0d000000-0000-0000-0000-00000000000d',true),
 ('aaaaaaaa-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001','0d000000-0000-0000-0000-00000000000d',false),
 ('aaaaaaaa-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001','0d000000-0000-0000-0000-00000000000d',false);
select assert((select times_waited from player_stats where player_id='0d000000-0000-0000-0000-00000000000d')=1,
              'esperou 1 vez, nao 3 (defeito 7.6 corrigido)');

-- ===== O QUE O REDESIGN ACRESCENTOU =====
-- Quem lancou e quem corrigiu ficam gravados: a tela mostra "corrigido por X".
update matches set score_a=12, score_b=9,
  corrected_by='0a000000-0000-0000-0000-00000000000a', corrected_at=now()
where phase='final';
select assert((select point_difference from matches)=3,'a diferenca recalculou na correcao');
select assert((select corrected_by from matches) is not null,'gravou quem corrigiu');

-- O par-ou-impar de empate de diferenca (REGRAS.md 9.3): um por tipo.
insert into tiebreak_decisions (group_id,tournament_id,kind,winner_team_id,decided_by)
values ('aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001',
        'losers','70e00000-0000-0000-0000-00000000000a','0a000000-0000-0000-0000-00000000000a');
do $$ begin
  insert into tiebreak_decisions (group_id,tournament_id,kind,winner_team_id)
  values ('aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001',
          'losers','70e00000-0000-0000-0000-00000000000b');
  raise exception 'FALHOU: dois par-ou-impar do mesmo tipo';
exception when unique_violation then null; end $$;
insert into tiebreak_decisions (group_id,tournament_id,kind,winner_team_id)
values ('aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001',
        'winners','70e00000-0000-0000-0000-00000000000a');
select assert((select count(*) from tiebreak_decisions)=2,'perdedores e vencedores convivem');

select 'TODOS OS TESTES DE REGRA PASSARAM' as resultado;
