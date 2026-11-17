create or replace function assert(cond boolean, msg text)
returns void language plpgsql as $$
begin if not cond then raise exception 'FALHOU: %', msg; end if; end $$;

-- fixture: 1 grupo, 5 jogadores, DUAS noites, um campeonato por noite.
-- A segunda noite tem avulso (5 presentes), e é o que prova a conta de espera.
insert into groups (id, name, join_password_hash) values
 ('aaaaaaaa-0000-0000-0000-000000000001','Unaerp',crypt('volei99', gen_salt('bf')));

insert into players (id, group_id, name, gender, birth_date) values
 ('0a000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','Douglas','M','1990-05-10'),
 ('0b000000-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000001','Wily','M','1995-07-02'),
 ('0c000000-0000-0000-0000-00000000000c','aaaaaaaa-0000-0000-0000-000000000001','Laura','F','1988-09-08'),
 ('0d000000-0000-0000-0000-00000000000d','aaaaaaaa-0000-0000-0000-000000000001','Raul','M','1997-05-19'),
 ('0e000000-0000-0000-0000-00000000000e','aaaaaaaa-0000-0000-0000-000000000001','Be','F','1991-01-01');

insert into sessions (id, group_id, date) values
 ('5e550000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001', current_date - 7),
 ('5e550000-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001', current_date);

-- O sorteio da segunda noite deixou a Be esperando. As outras duas propostas
-- do mesmo sorteio NÃO foram escolhidas: elas não podem contar espera nenhuma.
insert into draws (id, group_id, session_id, selected, waiting_player_id) values
 ('d2a00000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001', true,  null),
 ('d2a00000-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000002', true,  '0e000000-0000-0000-0000-00000000000e'),
 ('d2a00000-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000002', false, '0e000000-0000-0000-0000-00000000000e');

insert into tournaments (id, group_id, session_id, draw_id, name, format_id, point_limit) values
 ('7040000a-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001','d2a00000-0000-0000-0000-000000000001','Noite 1','knockout-2',12),
 ('7040000a-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000002','d2a00000-0000-0000-0000-000000000002','Noite 2','knockout-2',12);

-- Douglas + Wily jogam juntos nas DUAS noites: é a "dupla do coração" que
-- precisa somar no mesmo lugar.
insert into tournament_teams (id, group_id, tournament_id, position, player1_id, player2_id) values
 ('70e00000-0000-0000-0000-00000000000a','aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001',1,'0a000000-0000-0000-0000-00000000000a','0b000000-0000-0000-0000-00000000000b'),
 ('70e00000-0000-0000-0000-00000000000b','aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001',2,'0c000000-0000-0000-0000-00000000000c','0d000000-0000-0000-0000-00000000000d'),
 -- Na noite 2 a ordem do par vem invertida de propósito: a dupla é o PAR,
 -- não a ordem em que o sorteio sentou os dois.
 ('70e00000-0000-0000-0000-00000000000c','aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000002',1,'0b000000-0000-0000-0000-00000000000b','0a000000-0000-0000-0000-00000000000a'),
 ('70e00000-0000-0000-0000-00000000000d','aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000002',2,'0c000000-0000-0000-0000-00000000000c','0d000000-0000-0000-0000-00000000000d');

-- Noite 1: Douglas+Wily vencem. Noite 2: perdem.
insert into matches (group_id,tournament_id,session_id,phase,team_a_id,team_b_id,score_a,score_b) values
 ('aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000001','5e550000-0000-0000-0000-000000000001','final','70e00000-0000-0000-0000-00000000000a','70e00000-0000-0000-0000-00000000000b',12,7),
 ('aaaaaaaa-0000-0000-0000-000000000001','7040000a-0000-0000-0000-000000000002','5e550000-0000-0000-0000-000000000002','final','70e00000-0000-0000-0000-00000000000c','70e00000-0000-0000-0000-00000000000d',9,12);

-- ===== A CONTA É POR NOITE, E NÃO O TOTAL =====
select assert(
  (select count(*) from player_session_stats
    where player_id='0a000000-0000-0000-0000-00000000000a') = 2,
  'Douglas tem uma linha por noite');

select assert(
  (select wins from player_session_stats
    where player_id='0a000000-0000-0000-0000-00000000000a'
      and session_id='5e550000-0000-0000-0000-000000000001') = 1,
  'noite 1: Douglas venceu');

select assert(
  (select wins from player_session_stats
    where player_id='0a000000-0000-0000-0000-00000000000a'
      and session_id='5e550000-0000-0000-0000-000000000002') = 0,
  'noite 2: Douglas perdeu');

-- Somadas, as linhas por noite têm de bater com a view de todos os tempos:
-- duas contagens que divergem são pior do que uma só.
select assert(
  (select sum(games_played) from player_session_stats
    where player_id='0a000000-0000-0000-0000-00000000000a')
  = (select games_played from player_stats
      where player_id='0a000000-0000-0000-0000-00000000000a'),
  'a soma das noites bate com player_stats');

-- ===== ESPERA CONTA NA NOITE CERTA, E SÓ DO SORTEIO ESCOLHIDO =====
select assert(
  (select times_waited from player_session_stats
    where player_id='0e000000-0000-0000-0000-00000000000e'
      and session_id='5e550000-0000-0000-0000-000000000002') = 1,
  'a espera da Be conta uma vez, não três propostas');

-- Ela só esperou: não tem partida nenhuma, e mesmo assim precisa aparecer.
select assert(
  (select games_played from player_session_stats
    where player_id='0e000000-0000-0000-0000-00000000000e'
      and session_id='5e550000-0000-0000-0000-000000000002') = 0,
  'quem só esperou aparece com zero jogo');

select assert(
  (select count(*) from player_session_stats
    where player_id='0e000000-0000-0000-0000-00000000000e'
      and session_id='5e550000-0000-0000-0000-000000000001') = 0,
  'a Be não aparece na noite em que não esteve');

-- ===== DUPLA É O PAR, EM QUALQUER ORDEM =====
select assert(
  (select count(*) from team_session_stats
    where player1_id='0a000000-0000-0000-0000-00000000000a'
      and player2_id='0b000000-0000-0000-0000-00000000000b') = 2,
  'Douglas + Wily têm uma linha por noite, mesmo com o par invertido');

select assert(
  (select sum(wins) from team_session_stats
    where player1_id='0a000000-0000-0000-0000-00000000000a'
      and player2_id='0b000000-0000-0000-0000-00000000000b') = 1,
  'a dupla venceu uma das duas noites');

select assert(
  (select sum(games_played) from team_session_stats
    where player1_id='0a000000-0000-0000-0000-00000000000a'
      and player2_id='0b000000-0000-0000-0000-00000000000b')
  = (select games_played from team_stats
      where player1_id='0a000000-0000-0000-0000-00000000000a'
        and player2_id='0b000000-0000-0000-0000-00000000000b'),
  'a soma das noites bate com team_stats');
