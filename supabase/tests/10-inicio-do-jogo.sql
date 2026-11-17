create or replace function assert(cond boolean, msg text)
returns void language plpgsql as $$
begin if not cond then raise exception 'FALHOU: %', msg; end if; end $$;

insert into groups (id, name, join_password_hash) values
 ('aaaaaaaa-0000-0000-0000-000000000001','Unaerp',crypt('volei99', gen_salt('bf'))),
 ('bbbbbbbb-0000-0000-0000-000000000002','Outro',crypt('volei99', gen_salt('bf')));
insert into players (id, group_id, name, gender, birth_date) values
 ('0a000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','Douglas','M','1990-05-10'),
 ('0b000000-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000001','Wily','M','1995-07-02'),
 ('0c000000-0000-0000-0000-00000000000c','aaaaaaaa-0000-0000-0000-000000000001','Laura','F','1988-09-08'),
 ('0d000000-0000-0000-0000-00000000000d','aaaaaaaa-0000-0000-0000-000000000001','Raul','M','1997-05-19'),
 ('0e000000-0000-0000-0000-00000000000e','bbbbbbbb-0000-0000-0000-000000000002','Intruso','M','1991-01-01');
insert into sessions (id, group_id, date) values
 ('5e550000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001', current_date);
insert into draws (id, group_id, session_id, selected) values
 ('d2a00000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001', true);
insert into tournaments (id, group_id, session_id, draw_id, name, format_id, point_limit) values
 ('7040000a-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001','d2a00000-0000-0000-0000-000000000001','Teste','knockout-2',12);
insert into tournament_teams (id, group_id, tournament_id, position, player1_id, player2_id) values
 ('70e00000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001',1,'0a000000-0000-0000-0000-00000000000a','0b000000-0000-0000-0000-00000000000b'),
 ('70e00000-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001',2,'0c000000-0000-0000-0000-00000000000c','0d000000-0000-0000-0000-00000000000d');

-- ===== PLACAR SEM INÍCIO DE JOGO CONTINUA VALENDO =====
insert into matches (id,group_id,tournament_id,session_id,phase,team_a_id,team_b_id,score_a,score_b)
values ('ba7c0000-0000-0000-0000-00000000000f','aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001','final','70e00000-0000-0000-0000-00000000000a','70e00000-0000-0000-0000-00000000000b',12,7);
select assert((select coin_choice from matches where id='ba7c0000-0000-0000-0000-00000000000f') is null,
              'partida sem par-ou-impar continua valendo');

-- ===== O REGISTRO COMPLETO ENTRA =====
insert into matches (id,group_id,tournament_id,session_id,phase,team_a_id,team_b_id,score_a,score_b,
                     coin_winner_team_id,coin_caller_player_id,coin_choice,team_a_side,first_server_team_id)
values ('ba7c0000-0000-0000-0000-000000000010','aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001','semifinal','70e00000-0000-0000-0000-00000000000a','70e00000-0000-0000-0000-00000000000b',12,9,
        '70e00000-0000-0000-0000-00000000000a','0a000000-0000-0000-0000-00000000000a','saque','esquerda','70e00000-0000-0000-0000-00000000000a');
select assert((select first_server_team_id from matches where id='ba7c0000-0000-0000-0000-000000000010')
              = '70e00000-0000-0000-0000-00000000000a', 'quem escolheu saque abre sacando');

-- ===== QUEM ESCOLHEU LADO NAO PODE ABRIR SACANDO =====
do $$ begin
  insert into matches (group_id,tournament_id,session_id,phase,team_a_id,team_b_id,score_a,score_b,
                       coin_winner_team_id,coin_choice,first_server_team_id)
  values ('aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001','round-1','70e00000-0000-0000-0000-00000000000a','70e00000-0000-0000-0000-00000000000b',12,3,
          '70e00000-0000-0000-0000-00000000000a','lado','70e00000-0000-0000-0000-00000000000a');
  raise exception 'FALHOU: aceitou sacador contradizendo a escolha';
exception when check_violation then null; end $$;

-- ===== ESCOLHA E LADO SO ACEITAM O QUE EXISTE =====
do $$ begin
  insert into matches (group_id,tournament_id,session_id,phase,team_a_id,team_b_id,score_a,score_b,coin_choice)
  values ('aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001','round-1','70e00000-0000-0000-0000-00000000000a','70e00000-0000-0000-0000-00000000000b',12,3,'cara-ou-coroa');
  raise exception 'FALHOU: aceitou escolha inexistente';
exception when check_violation then null; end $$;

do $$ begin
  insert into matches (group_id,tournament_id,session_id,phase,team_a_id,team_b_id,score_a,score_b,team_a_side)
  values ('aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001','round-1','70e00000-0000-0000-0000-00000000000a','70e00000-0000-0000-0000-00000000000b',12,3,'fundo');
  raise exception 'FALHOU: aceitou lado inexistente';
exception when check_violation then null; end $$;

-- ===== A DUPLA DO PAR-OU-IMPAR E DESTE JOGO =====
insert into tournament_teams (id, group_id, tournament_id, position, player1_id, player2_id) values
 ('70e00000-0000-0000-0000-00000000000c','aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001',3,'0a000000-0000-0000-0000-00000000000a','0d000000-0000-0000-0000-00000000000d');
do $$ begin
  insert into matches (group_id,tournament_id,session_id,phase,team_a_id,team_b_id,score_a,score_b,coin_winner_team_id,coin_choice)
  values ('aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001','round-1','70e00000-0000-0000-0000-00000000000a','70e00000-0000-0000-0000-00000000000b',12,3,
          '70e00000-0000-0000-0000-00000000000c','saque');
  raise exception 'FALHOU: aceitou dupla que nao esta no jogo';
exception when check_violation then null; end $$;

-- ===== QUEM CHAMOU E DO MESMO VOLEI =====
do $$ begin
  insert into matches (group_id,tournament_id,session_id,phase,team_a_id,team_b_id,score_a,score_b,coin_caller_player_id)
  values ('aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001','round-1','70e00000-0000-0000-0000-00000000000a','70e00000-0000-0000-0000-00000000000b',12,3,
          '0e000000-0000-0000-0000-00000000000e');
  raise exception 'FALHOU: aceitou quem chamou de outro volei';
exception when foreign_key_violation then null; end $$;
