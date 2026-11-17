create or replace function assert(cond boolean, msg text)
returns void language plpgsql as $$
begin if not cond then raise exception 'FALHOU: %', msg; end if; end $$;

insert into groups (id, name, join_password_hash) values
 ('aaaaaaaa-0000-0000-0000-000000000001','Unaerp',crypt('volei99', gen_salt('bf')));
insert into players (id, group_id, name, gender, birth_date) values
 ('0a000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','Douglas','M','1990-05-10'),
 ('0b000000-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000001','Wily','M','1995-07-02'),
 ('0c000000-0000-0000-0000-00000000000c','aaaaaaaa-0000-0000-0000-000000000001','Laura','F','1988-09-08'),
 ('0d000000-0000-0000-0000-00000000000d','aaaaaaaa-0000-0000-0000-000000000001','Raul','M','1997-05-19');
insert into sessions (id, group_id, date) values
 ('5e550000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001', current_date);
insert into draws (id, group_id, session_id, selected) values
 ('d2a00000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001', true);
insert into tournaments (id, group_id, session_id, draw_id, name, format_id, point_limit) values
 ('7040000a-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001','d2a00000-0000-0000-0000-000000000001','Teste','knockout-2',3);
insert into tournament_teams (id, group_id, tournament_id, position, player1_id, player2_id) values
 ('70e00000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001',1,'0a000000-0000-0000-0000-00000000000a','0b000000-0000-0000-0000-00000000000b'),
 ('70e00000-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001',2,'0c000000-0000-0000-0000-00000000000c','0d000000-0000-0000-0000-00000000000d');

-- ===== A SEQUÊNCIA ENTRA JUNTO COM O PLACAR =====
insert into matches (id,group_id,tournament_id,session_id,phase,team_a_id,team_b_id,score_a,score_b,rally_log)
values ('ba7c0000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001','final','70e00000-0000-0000-0000-00000000000a','70e00000-0000-0000-0000-00000000000b',3,1,
        array[0,1,0,0]::smallint[]);
select assert((select cardinality(rally_log) from matches where id='ba7c0000-0000-0000-0000-000000000001') = 4,
              'a sequencia de ralis foi guardada');

-- ===== PLACAR SEM SEQUÊNCIA CONTINUA VALENDO =====
insert into matches (id,group_id,tournament_id,session_id,phase,team_a_id,team_b_id,score_a,score_b)
values ('ba7c0000-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001','semifinal','70e00000-0000-0000-0000-00000000000a','70e00000-0000-0000-0000-00000000000b',3,0);
select assert((select rally_log from matches where id='ba7c0000-0000-0000-0000-000000000002') is null,
              'partida digitada de uma vez nao tem sequencia');

-- ===== SÓ EXISTEM DOIS LADOS =====
do $$ begin
  insert into matches (group_id,tournament_id,session_id,phase,team_a_id,team_b_id,score_a,score_b,rally_log)
  values ('aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001','round-1','70e00000-0000-0000-0000-00000000000a','70e00000-0000-0000-0000-00000000000b',3,1,
          array[0,2,0,0]::smallint[]);
  raise exception 'FALHOU: aceitou rali de uma terceira dupla';
exception when check_violation then null; end $$;
