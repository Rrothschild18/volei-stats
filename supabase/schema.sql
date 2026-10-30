-- =============================================================================
-- VoleiStats — schema Supabase
-- Rode este arquivo inteiro no SQL Editor do projeto (uma vez).
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type tournament_status as enum ('in-progress', 'completed');
create type match_phase       as enum ('round-1', 'semifinal', 'semifinal-bye', 'final', 'third-place');
create type priority_reason   as enum ('waiting-draw', 'direct-elimination', 'coin-flip-loss', 'waiting-player-not-used');

-- -----------------------------------------------------------------------------
-- Jogadores
-- ATENÇÃO: jogador é um REGISTRO, não uma conta de usuário.
-- auth_user_id é opcional e só serve para "quem sou eu" (ver plano, Nível 1).
-- -----------------------------------------------------------------------------
create table players (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) > 0),
  gender       char(1) not null check (gender in ('M', 'F')),
  active       boolean not null default true,
  birth_date   date,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index players_name_key on players (lower(trim(name)));
create index players_active_idx on players (active);

-- -----------------------------------------------------------------------------
-- Organizadores: as únicas contas que podem ESCREVER
-- -----------------------------------------------------------------------------
create table organizers (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  player_id  uuid references players(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function is_organizer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from organizers where user_id = auth.uid())
$$;

-- -----------------------------------------------------------------------------
-- Sessões (um dia de jogo)
-- -----------------------------------------------------------------------------
create table sessions (
  id         uuid primary key default gen_random_uuid(),
  date       date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sessions_date_idx on sessions (date desc);

create table session_players (
  session_id uuid not null references sessions(id) on delete cascade,
  player_id  uuid not null references players(id)  on delete restrict,
  primary key (session_id, player_id)
);

-- -----------------------------------------------------------------------------
-- Sorteios
-- -----------------------------------------------------------------------------
create table draws (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references sessions(id) on delete cascade,
  waiting_player_id uuid references players(id),
  score             int not null default 0,
  selected          boolean not null default false,
  created_at        timestamptz not null default now()
);
create index draws_session_idx on draws (session_id);
-- Só um sorteio selecionado por "rodada" de propostas é garantido pela aplicação;
-- se quiser travar no banco, crie um grupo (proposal_group_id) e um índice único parcial.

create table draw_teams (
  id         uuid primary key default gen_random_uuid(),
  draw_id    uuid not null references draws(id) on delete cascade,
  position   int  not null,
  player1_id uuid not null references players(id),
  player2_id uuid not null references players(id),
  check (player1_id <> player2_id),
  unique (draw_id, position)
);
create index draw_teams_draw_idx on draw_teams (draw_id);

-- -----------------------------------------------------------------------------
-- Campeonatos
-- -----------------------------------------------------------------------------
create table tournaments (
  id                               uuid primary key default gen_random_uuid(),
  session_id                       uuid not null references sessions(id) on delete cascade,
  draw_id                          uuid not null references draws(id)    on delete restrict,
  name                             text not null,
  point_limit                      int  not null check (point_limit >= 1),
  third_place_enabled              boolean not null default true,
  odd_player_placement_enabled     boolean not null default false,
  odd_player_loser_priority_enabled boolean not null default false,
  waiting_player_id                uuid references players(id),
  status                           tournament_status not null default 'in-progress',
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now()
);
create index tournaments_session_idx on tournaments (session_id, created_at);

create table tournament_teams (
  id                  uuid primary key default gen_random_uuid(),
  tournament_id       uuid not null references tournaments(id) on delete cascade,
  position            int  not null,
  player1_id          uuid not null references players(id),
  player2_id          uuid not null references players(id),
  eliminated          boolean not null default false,
  eliminated_directly boolean not null default false,
  synthetic           boolean not null default false,
  original_player1_id uuid references players(id),
  original_player2_id uuid references players(id),
  check (player1_id <> player2_id),
  unique (tournament_id, position)
);
create index tournament_teams_tournament_idx on tournament_teams (tournament_id);

create table odd_player_placements (
  tournament_id        uuid primary key references tournaments(id) on delete cascade,
  source_team_id       uuid not null references tournament_teams(id) on delete cascade,
  encaixe_team_id      uuid not null references tournament_teams(id) on delete cascade,
  surviving_player_id  uuid not null references players(id),
  eliminated_player_id uuid not null references players(id),
  created_at           timestamptz not null default now(),
  check (surviving_player_id <> eliminated_player_id)
);

-- -----------------------------------------------------------------------------
-- Partidas
-- As regras de placar viram CONSTRAINTS: o banco recusa empate e 0x0.
-- winner/loser/diferença são colunas GERADAS — impossível ficarem inconsistentes.
-- -----------------------------------------------------------------------------
create table matches (
  id               uuid primary key default gen_random_uuid(),
  tournament_id    uuid not null references tournaments(id) on delete cascade,
  session_id       uuid not null references sessions(id)    on delete cascade,
  phase            match_phase not null,
  team_a_id        uuid not null references tournament_teams(id) on delete cascade,
  team_b_id        uuid not null references tournament_teams(id) on delete cascade,
  score_a          int not null check (score_a >= 0),
  score_b          int not null check (score_b >= 0),
  winner_id        uuid generated always as (case when score_a > score_b then team_a_id else team_b_id end) stored,
  loser_id         uuid generated always as (case when score_a > score_b then team_b_id else team_a_id end) stored,
  point_difference int  generated always as (abs(score_a - score_b)) stored,
  played_at        timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  check (team_a_id <> team_b_id),
  check (score_a <> score_b),      -- vôlei não tem empate
  check (score_a + score_b > 0),   -- não existe 0 x 0
  unique (tournament_id, phase, team_a_id, team_b_id)
);
create index matches_tournament_idx on matches (tournament_id);
create index matches_session_idx    on matches (session_id);
create index matches_played_idx     on matches (played_at desc);

-- -----------------------------------------------------------------------------
-- Prioridades e classificação
-- -----------------------------------------------------------------------------
create table tournament_priority_entries (
  tournament_id uuid not null references tournaments(id) on delete cascade,
  player_id     uuid not null references players(id)     on delete cascade,
  reason        priority_reason not null,
  primary key (tournament_id, player_id, reason)
);

create table tournament_standings (
  tournament_id uuid not null references tournaments(id)      on delete cascade,
  team_id       uuid not null references tournament_teams(id) on delete cascade,
  position      int  not null check (position >= 1),
  primary key (tournament_id, team_id),
  unique (tournament_id, position)
);

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger players_touch     before update on players     for each row execute function touch_updated_at();
create trigger sessions_touch    before update on sessions    for each row execute function touch_updated_at();
create trigger tournaments_touch before update on tournaments for each row execute function touch_updated_at();

-- =============================================================================
-- VIEWS DE ESTATÍSTICA
-- Substituem os laços do StatisticsService. Uma query em vez de N+1.
-- =============================================================================

-- Uma linha por jogador por partida jogada
create or replace view player_match_results as
select
  m.id            as match_id,
  m.session_id,
  m.tournament_id,
  m.played_at,
  p.player_id,
  t.id            as team_id,
  (m.winner_id = t.id) as won
from matches m
join tournament_teams t on t.id in (m.team_a_id, m.team_b_id)
cross join lateral (values (t.player1_id), (t.player2_id)) as p(player_id);

create or replace view player_stats as
select
  pl.id as player_id,
  pl.name,
  coalesce(r.games_played, 0) as games_played,
  coalesce(r.wins, 0)         as wins,
  coalesce(r.losses, 0)       as losses,
  coalesce(w.times_waited, 0) as times_waited,
  case when coalesce(r.games_played, 0) > 0
       then round(100.0 * r.wins / r.games_played)::int
       else 0 end as win_percentage
from players pl
left join (
  select player_id,
         count(*)                       as games_played,
         count(*) filter (where won)    as wins,
         count(*) filter (where not won) as losses
  from player_match_results
  group by player_id
) r on r.player_id = pl.id
left join (
  -- conta apenas sorteios SELECIONADOS (corrige a contagem triplicada)
  select waiting_player_id as player_id, count(*) as times_waited
  from draws
  where selected and waiting_player_id is not null
  group by waiting_player_id
) w on w.player_id = pl.id;

-- Dupla identificada pelo PAR de jogadores (ordenado), não pelo id da dupla
create or replace view team_stats as
with team_matches as (
  select
    least(t.player1_id, t.player2_id)    as p1,
    greatest(t.player1_id, t.player2_id) as p2,
    (m.winner_id = t.id)                 as won
  from matches m
  join tournament_teams t on t.id in (m.team_a_id, m.team_b_id)
)
select
  p1 as player1_id,
  p2 as player2_id,
  count(*)                        as games_played,
  count(*) filter (where won)     as wins,
  count(*) filter (where not won) as losses,
  round(100.0 * count(*) filter (where won) / count(*))::int as win_percentage
from team_matches
group by p1, p2;

-- =============================================================================
-- ROW LEVEL SECURITY
--
-- Modelo: LEITURA PÚBLICA, ESCRITA SÓ PARA ORGANIZADOR.
--
-- ⚠️ Usuários anônimos (signInAnonymously) recebem o papel `authenticated`,
--    NÃO `anon`. Por isso toda policy de escrita usa is_organizer(), que
--    consulta a tabela organizers — um anônimo nunca está lá.
-- =============================================================================

alter table players                     enable row level security;
alter table organizers                  enable row level security;
alter table sessions                    enable row level security;
alter table session_players             enable row level security;
alter table draws                       enable row level security;
alter table draw_teams                  enable row level security;
alter table tournaments                 enable row level security;
alter table tournament_teams            enable row level security;
alter table odd_player_placements       enable row level security;
alter table matches                     enable row level security;
alter table tournament_priority_entries enable row level security;
alter table tournament_standings        enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'players','sessions','session_players','draws','draw_teams','tournaments',
    'tournament_teams','odd_player_placements','matches',
    'tournament_priority_entries','tournament_standings'
  ] loop
    execute format(
      'create policy %I on %I for select to anon, authenticated using (true)',
      tbl || '_select_public', tbl);
    execute format(
      'create policy %I on %I for all to authenticated using (is_organizer()) with check (is_organizer())',
      tbl || '_write_organizer', tbl);
  end loop;
end $$;

-- A tabela organizers não é pública: cada um só enxerga a própria linha.
create policy organizers_select_self on organizers
  for select to authenticated using (user_id = auth.uid());

-- Nota: inclusão de organizador é feita manualmente pelo SQL Editor:
--   insert into organizers (user_id) values ('<uuid do auth.users>');
