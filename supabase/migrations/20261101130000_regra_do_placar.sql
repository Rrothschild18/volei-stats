-- =============================================================================
-- A regra do placar no banco: limite de pontos com dois de diferença.
--
-- O schema inicial já recusava empate e 0 × 0 por CHECK, mas o limite de
-- pontos do campeonato ficava só no app — e `point_limit` mora em `tournaments`,
-- não na linha de `matches`, então um CHECK de coluna não alcança. Daí o
-- trigger.
--
-- A regra é a de `core/rules/final-score.ts`, a mesma que a folha de placar lê:
--
--   • abaixo do limite       → PASSA. É o jogo interrompido (acabou o horário,
--                              começou a chover), e ele existe de verdade. Na
--                              tela é pergunta, aqui é silêncio: o banco não
--                              tem como perguntar nada a ninguém.
--   • no limite exato        → precisa de dois de diferença. 12 × 10 vale,
--                              12 × 11 não: em 11 × 11 o jogo continua.
--   • acima do limite        → só empurrando o empate, e aí ele para no
--                              instante em que alguém abre dois. 14 × 12 vale,
--                              14 × 11 não — esse jogo teria acabado em 13 × 11.
--
-- Por que repetir no banco o que a tela já faz: é a lição do ticket 32, a mesma
-- que trouxe o prazo dos 30 minutos para cá. A tela sozinha é guardiã de um
-- caminho só; aba velha, link antigo, outro cliente ou um `curl` entram pelos
-- outros. E placar errado não fica parado: ele decide quem vai à final.
--
-- O trigger só olha quando o placar MUDA. Uma linha antiga que não obedece à
-- regra (campeonato de antes desta migration) continua lá e pode ser corrigida;
-- o que ela não pode é receber um placar novo igualmente impossível.
-- =============================================================================
create or replace function check_final_score()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  limite  int;
  vencedo int;
  perdedo int;
begin
  if tg_op = 'UPDATE' and new.score_a = old.score_a and new.score_b = old.score_b then
    return new;
  end if;

  select point_limit into limite from tournaments where id = new.tournament_id;
  if limite is null then
    return new;
  end if;

  vencedo := greatest(new.score_a, new.score_b);
  perdedo := least(new.score_a, new.score_b);

  -- Jogo interrompido: para antes do limite e vale assim mesmo.
  if vencedo < limite then
    return new;
  end if;

  if vencedo = limite and vencedo - perdedo < 2 then
    raise exception
      'Em % o jogo não acaba por um ponto: vai até alguém abrir dois (placar % × %).',
      limite, new.score_a, new.score_b
      using errcode = 'check_violation';
  end if;

  if vencedo > limite and vencedo <> perdedo + 2 then
    raise exception
      'Com limite de %, o jogo teria parado antes de % × %.',
      limite, new.score_a, new.score_b
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

-- Depois de `matches_stamp_author` (ordem alfabética entre triggers BEFORE do
-- mesmo evento): quem assina a correção não muda o placar, então tanto faz —
-- mas deixar explícito evita surpresa se um dia um deles passar a mexer.
drop trigger if exists matches_check_final_score on matches;
create trigger matches_check_final_score
  before insert or update on matches
  for each row execute function check_final_score();
