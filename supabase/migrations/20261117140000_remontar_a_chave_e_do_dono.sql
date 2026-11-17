-- =============================================================================
-- Mudar a POSIÇÃO de uma dupla é do dono (ticket 44).
--
-- A ordem das duplas é o confronto: a primeira enfrenta a segunda, a terceira a
-- quarta. Remontar a chave de um campeonato em andamento é, portanto, decisão
-- de organizador — e a tela já trata assim, mostrando o gesto só para o dono.
--
-- Só que a política de `tournament_teams` é `for update ... using
-- (is_group_player(group_id))`, e ela não tem como olhar COLUNA: o app reescreve
-- `eliminated` e o encaixe jogando, e isso é de qualquer jogador. Sem esta
-- trava, a regra "remontar a chave é do dono" vivia só na tela — e a lição do
-- ticket 32 é exatamente essa: a tela é guardiã de um caminho só, e aba velha,
-- link antigo, outro cliente ou um `curl` entram pelos outros.
--
-- Um gatilho resolve o que a política não alcança: recusa a troca de `position`
-- por quem não é dono, e deixa o resto da linha como está hoje.
--
-- Inserir duplas continua de jogador: é assim que um campeonato nasce, e a
-- posição ali é a do sorteio, não uma remontagem.
-- =============================================================================
create or replace function check_team_position_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.position is distinct from old.position and not is_group_owner(new.group_id) then
    raise exception 'Só quem é dono muda a ordem das duplas na chave'
      using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists tournament_teams_position_owner on tournament_teams;
create trigger tournament_teams_position_owner
  before update on tournament_teams
  for each row execute function check_team_position_owner();
