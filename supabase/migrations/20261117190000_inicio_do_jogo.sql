-- =============================================================================
-- O início do jogo: par-ou-ímpar, lado da quadra e saque inicial (ticket 07)
--
-- Na quadra o jogo começa antes do placar: duas duplas tiram par ou ímpar, quem
-- ganha escolhe saque ou lado, e é isso que decide quem abre sacando. O app
-- guardava só o fim (o placar) e perdia o começo.
--
-- Tudo é ANULÁVEL de propósito:
--   * as partidas já lançadas continuam válidas, sem inventar passado;
--   * o passo é pulável — quem só quer lançar o resultado continua lançando.
--
-- Consequência que a estatística precisa respeitar: partida sem registro não
-- é "perdeu o par-ou-ímpar", é partida sem registro. Quem contar isso tem de
-- dizer sobre quantas partidas está falando.
-- =============================================================================

alter table matches
  add column coin_winner_team_id   uuid,
  add column coin_caller_player_id uuid,
  add column coin_choice           text,
  add column team_a_side           text,
  add column first_server_team_id  uuid;

-- As chaves são compostas com group_id, como em todo o schema: sem isso dá
-- para apontar o par-ou-ímpar desta partida para a dupla de outro vôlei.
alter table matches
  add constraint matches_coin_winner_fkey
    foreign key (coin_winner_team_id, group_id) references tournament_teams(id, group_id) on delete cascade,
  add constraint matches_coin_caller_fkey
    foreign key (coin_caller_player_id, group_id) references players(id, group_id),
  add constraint matches_first_server_fkey
    foreign key (first_server_team_id, group_id) references tournament_teams(id, group_id) on delete cascade;

alter table matches
  add constraint matches_coin_choice_check
    check (coin_choice is null or coin_choice in ('saque','lado')),
  add constraint matches_team_a_side_check
    check (team_a_side is null or team_a_side in ('esquerda','direita'));

-- Quem abre sacando é DERIVADO do par-ou-ímpar (quem escolheu saque saca; quem
-- escolheu lado entrega o saque). Guardar a coluna e deixá-la livre permitiria
-- gravar um sacador que contradiz a escolha — e aí o app teria duas verdades
-- sobre o mesmo momento.
alter table matches
  add constraint matches_first_server_segue_o_par_ou_impar
    check (
      first_server_team_id is null
      or coin_winner_team_id is null
      or coin_choice is null
      or (
        case
          when coin_choice = 'saque' then first_server_team_id = coin_winner_team_id
          else first_server_team_id <> coin_winner_team_id
        end
      )
    );

-- A dupla do par-ou-ímpar e a que abre sacando são do jogo, não de outro
-- qualquer: as duas têm de estar nesta partida.
alter table matches
  add constraint matches_coin_winner_esta_no_jogo
    check (coin_winner_team_id is null or coin_winner_team_id in (team_a_id, team_b_id)),
  add constraint matches_first_server_esta_no_jogo
    check (first_server_team_id is null or first_server_team_id in (team_a_id, team_b_id));
