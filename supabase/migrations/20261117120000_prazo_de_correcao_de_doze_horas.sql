-- =============================================================================
-- O prazo para corrigir um placar passa de 30 minutos para 12 horas.
--
-- Trinta minutos era pouco. A noite continua depois da final, a quadra é
-- devolvida, e o número errado costuma aparecer só quando alguém olha o ranking
-- em casa — com o campeonato já fechado e nada a fazer além de excluir.
--
-- Doze horas é a mesma régua de HORAS_ATE_DESISTIR (src/app/core/rules/
-- tournament-timing.ts), que é quando o app já considera que um campeonato sem
-- final ficou pelo caminho. Cobre a noite e a manhã seguinte, e para antes de
-- qualquer outro dia de jogo: nenhuma sessão da semana seguinte é alcançada.
--
-- A função é reescrita inteira, e não só o número: migration publicada não se
-- edita. O resto do corpo é idêntico ao de 20261101120000_correcao_de_placar,
-- inclusive o raciocínio que está comentado lá — o `security definer`, o
-- alcance do apagar e a razão de o prazo viver também aqui (ticket 43).
-- =============================================================================
create or replace function correct_match_score(
  p_match_id           uuid,
  p_score_a            int,
  p_score_b            int,
  p_obsolete_match_ids uuid[] default '{}',
  p_dissolved_team_id  uuid   default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_group      uuid;
  v_tournament uuid;
  v_ended      timestamptz;
begin
  select group_id, tournament_id into v_group, v_tournament
  from matches where id = p_match_id;

  if v_group is null then
    raise exception 'Esta partida não existe mais' using errcode = 'P0002';
  end if;

  if not is_group_player(v_group) then
    raise exception 'Só quem joga neste vôlei corrige placar' using errcode = '42501';
  end if;

  -- O fim do campeonato é o `played_at` da final, e não a hora de agora nem a
  -- da sessão. Enquanto a final não saiu, corrigir vale sem prazo: o campeonato
  -- está acontecendo, e corrigir é parte de jogar.
  --
  -- As 12 horas são as mesmas de CORRECTION_WINDOW_MINUTES, em
  -- src/app/core/rules/tournament-timing.ts. Mudou um, muda o outro.
  select played_at into v_ended
  from matches
  where tournament_id = v_tournament and phase = 'final'
  order by played_at desc
  limit 1;

  if v_ended is not null and now() > v_ended + interval '12 hours' then
    raise exception 'Este campeonato fechou. Placar só até 12h depois do fim.'
      using errcode = '42501';
  end if;

  -- A partida corrigida nunca é apagada por si mesma. Parece óbvio e não é: o
  -- cliente calcula a lista a partir da chave, e num formato de duas duplas a
  -- rodada inicial É a final — um erro ali apagaria exatamente o placar que
  -- alguém acabou de consertar. Esta trava não depende de conhecer formato.
  if p_match_id = any(p_obsolete_match_ids) then
    raise exception 'A partida corrigida não é apagada pela própria correção'
      using errcode = '42501';
  end if;

  -- O resto do alcance, conferido aqui e não no cliente: do mesmo campeonato,
  -- e nunca da rodada 1 — ela é a causa da correção, não consequência dela.
  if exists (
    select 1 from matches
    where id = any(p_obsolete_match_ids)
      and (tournament_id is distinct from v_tournament or phase = 'round-1')
  ) then
    raise exception 'Uma correção só desfaz partidas posteriores do mesmo campeonato'
      using errcode = '42501';
  end if;

  -- A única dupla que uma correção desfaz é a sintética do encaixe: ela nasceu
  -- de um par-ou-ímpar que o resultado novo pode ter invalidado. As duplas do
  -- sorteio continuam sendo coisa de dono.
  if p_dissolved_team_id is not null and not exists (
    select 1 from tournament_teams
    where id = p_dissolved_team_id
      and tournament_id = v_tournament
      and synthetic
  ) then
    raise exception 'Só a dupla do encaixe é desfeita por uma correção'
      using errcode = '42501';
  end if;

  -- Daqui para baixo é uma transação só: ou a correção e tudo o que ela derruba,
  -- ou nada. Meio caminho deixaria o campeonato num estado que nenhuma tela
  -- sabe desenhar.
  update matches
  set score_a = p_score_a, score_b = p_score_b
  where id = p_match_id;

  delete from matches
  where id = any(p_obsolete_match_ids) and tournament_id = v_tournament;

  -- Leva por cascata o que restar das partidas dela e a linha do encaixe.
  if p_dissolved_team_id is not null then
    delete from tournament_teams where id = p_dissolved_team_id;
  end if;
end $$;
