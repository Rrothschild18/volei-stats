-- =============================================================================
-- VoleiStats — schema Supabase
--
-- MODELO DE ACESSO (ver docs/PLANO-SUPABASE.md §1)
--   * Sem e-mail, sem senha, sem login.
--   * Cada pessoa recebe uma sessão ANÔNIMA do Supabase, guardada no navegador.
--     É o "cookie de longa vida": sobrevive a fechar o navegador e se renova
--     sozinha enquanto a pessoa usar o site.
--   * O acesso é por LINK:
--       - link do grupo  (uuid)  -> entra como espectador e passa a ler
--       - link de convite (uuid) -> vira jogador (ou administrador)
--   * Perdeu o navegador? O administrador gera um novo link de convite
--     apontando para o MESMO jogador, e a pessoa volta com o histórico intacto.
--
-- Rode este arquivo inteiro no SQL Editor do projeto (uma vez).
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type group_role        as enum ('admin', 'player', 'viewer');
create type tournament_status as enum ('in-progress', 'completed');
create type match_phase       as enum ('round-1', 'semifinal', 'semifinal-bye', 'final', 'third-place');
create type priority_reason   as enum ('direct-elimination', 'coin-flip-loss', 'waiting-player-not-used');

-- =============================================================================
-- GRUPOS
-- O id do grupo é o segredo do link de leitura. Quem tem o uuid, lê.
-- =============================================================================
create table groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Jogadores (sempre dentro de um grupo)
-- -----------------------------------------------------------------------------
create table players (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references groups(id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  gender     char(1) not null check (gender in ('M', 'F')),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, group_id)
);
create unique index players_name_key on players (group_id, lower(trim(name)));
create index players_group_idx on players (group_id, active);

-- -----------------------------------------------------------------------------
-- Quem é quem: liga a sessão anônima do navegador a um grupo (e a um jogador)
--
-- Sem índice único em (group_id, player_id) DE PROPÓSITO: a mesma pessoa pode
-- estar no celular e no tablet, cada um com sua sessão anônima.
-- -----------------------------------------------------------------------------
create table group_members (
  group_id   uuid not null references groups(id)    on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  player_id  uuid references players(id)             on delete set null,
  role       group_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (group_id, user_id),
  foreign key (player_id, group_id) references players(id, group_id)
);
create index group_members_user_idx on group_members (user_id);

-- -----------------------------------------------------------------------------
-- Convites: os links que o administrador gera
-- -----------------------------------------------------------------------------
create table invites (
  token       uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  -- NULL      = convite de entrada  (a pessoa chega e digita o nome)
  -- preenchido = convite de re-associação (devolve o histórico a quem se perdeu)
  player_id   uuid references players(id) on delete cascade,
  grants_role group_role not null default 'player',
  label       text,
  expires_at  timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  foreign key (player_id, group_id) references players(id, group_id)
);
create index invites_group_idx on invites (group_id);

-- =============================================================================
-- SESSÕES, SORTEIOS, CAMPEONATOS
-- group_id é repetido em todas as tabelas de propósito: deixa as políticas de
-- segurança simples e rápidas, e as chaves compostas impedem que dados de dois
-- grupos se misturem.
-- =============================================================================
create table sessions (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references groups(id) on delete cascade,
  date       date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, group_id)
);
create index sessions_group_date_idx on sessions (group_id, date desc);

create table session_players (
  group_id   uuid not null,
  session_id uuid not null,
  player_id  uuid not null,
  primary key (session_id, player_id),
  foreign key (session_id, group_id) references sessions(id, group_id) on delete cascade,
  foreign key (player_id,  group_id) references players(id,  group_id) on delete restrict
);

create table draws (
  id                uuid primary key default gen_random_uuid(),
  group_id          uuid not null,
  session_id        uuid not null,
  waiting_player_id uuid,
  score             int not null default 0,
  selected          boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (id, group_id),
  foreign key (session_id, group_id)        references sessions(id, group_id) on delete cascade,
  foreign key (waiting_player_id, group_id) references players(id,  group_id)
);
create index draws_session_idx on draws (session_id);

create table draw_teams (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null,
  draw_id    uuid not null,
  position   int  not null,
  player1_id uuid not null,
  player2_id uuid not null,
  check (player1_id <> player2_id),
  unique (draw_id, position),
  foreign key (draw_id,    group_id) references draws(id,   group_id) on delete cascade,
  foreign key (player1_id, group_id) references players(id, group_id),
  foreign key (player2_id, group_id) references players(id, group_id)
);
create index draw_teams_draw_idx on draw_teams (draw_id);

create table tournaments (
  id                                uuid primary key default gen_random_uuid(),
  group_id                          uuid not null,
  session_id                        uuid not null,
  draw_id                           uuid not null,
  name                              text not null,
  -- id do formato no catálogo (src/app/core/rules/tournament-formats.ts)
  format_id                         text not null,
  point_limit                       int  not null check (point_limit >= 1),
  third_place_enabled               boolean not null default false,
  odd_player_placement_enabled      boolean not null default false,
  odd_player_loser_priority_enabled boolean not null default false,
  waiting_player_id                 uuid,
  status                            tournament_status not null default 'in-progress',
  created_at                        timestamptz not null default now(),
  updated_at                        timestamptz not null default now(),
  unique (id, group_id),
  foreign key (session_id, group_id)        references sessions(id, group_id) on delete cascade,
  foreign key (draw_id,    group_id)        references draws(id,    group_id) on delete restrict,
  foreign key (waiting_player_id, group_id) references players(id,  group_id)
);
create index tournaments_session_idx on tournaments (session_id, created_at);

create table tournament_teams (
  id                  uuid primary key default gen_random_uuid(),
  group_id            uuid not null,
  tournament_id       uuid not null,
  position            int  not null,
  player1_id          uuid not null,
  player2_id          uuid not null,
  eliminated          boolean not null default false,
  eliminated_directly boolean not null default false,
  synthetic           boolean not null default false,
  original_player1_id uuid,
  original_player2_id uuid,
  check (player1_id <> player2_id),
  unique (tournament_id, position),
  unique (id, group_id),
  foreign key (tournament_id, group_id) references tournaments(id, group_id) on delete cascade,
  foreign key (player1_id,    group_id) references players(id,     group_id),
  foreign key (player2_id,    group_id) references players(id,     group_id)
);
create index tournament_teams_tournament_idx on tournament_teams (tournament_id);

create table odd_player_placements (
  tournament_id        uuid primary key,
  group_id             uuid not null,
  source_team_id       uuid not null,
  encaixe_team_id      uuid not null,
  surviving_player_id  uuid not null,
  eliminated_player_id uuid not null,
  created_at           timestamptz not null default now(),
  check (surviving_player_id <> eliminated_player_id),
  foreign key (tournament_id,   group_id) references tournaments(id,      group_id) on delete cascade,
  foreign key (source_team_id,  group_id) references tournament_teams(id, group_id) on delete cascade,
  foreign key (encaixe_team_id, group_id) references tournament_teams(id, group_id) on delete cascade
);

-- -----------------------------------------------------------------------------
-- Partidas
-- As regras de placar viram CONSTRAINTS: o banco recusa empate e 0 x 0.
-- Vencedor, perdedor e diferença são colunas GERADAS — não há como divergirem.
-- -----------------------------------------------------------------------------
create table matches (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null,
  tournament_id    uuid not null,
  session_id       uuid not null,
  phase            match_phase not null,
  team_a_id        uuid not null,
  team_b_id        uuid not null,
  score_a          int not null check (score_a >= 0),
  score_b          int not null check (score_b >= 0),
  winner_id        uuid generated always as (case when score_a > score_b then team_a_id else team_b_id end) stored,
  loser_id         uuid generated always as (case when score_a > score_b then team_b_id else team_a_id end) stored,
  point_difference int  generated always as (abs(score_a - score_b)) stored,
  played_at        timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  check (team_a_id <> team_b_id),
  check (score_a <> score_b),     -- vôlei não tem empate
  check (score_a + score_b > 0),  -- não existe 0 x 0
  unique (tournament_id, phase, team_a_id, team_b_id),
  foreign key (tournament_id, group_id) references tournaments(id,      group_id) on delete cascade,
  foreign key (session_id,    group_id) references sessions(id,         group_id) on delete cascade,
  foreign key (team_a_id,     group_id) references tournament_teams(id, group_id) on delete cascade,
  foreign key (team_b_id,     group_id) references tournament_teams(id, group_id) on delete cascade
);
create index matches_tournament_idx on matches (tournament_id);
create index matches_group_played_idx on matches (group_id, played_at desc);

create table tournament_priority_entries (
  group_id      uuid not null,
  tournament_id uuid not null,
  player_id     uuid not null,
  reason        priority_reason not null,
  primary key (tournament_id, player_id, reason),
  foreign key (tournament_id, group_id) references tournaments(id, group_id) on delete cascade,
  foreign key (player_id,     group_id) references players(id,     group_id) on delete cascade
);

create table tournament_standings (
  group_id      uuid not null,
  tournament_id uuid not null,
  team_id       uuid not null,
  position      int  not null check (position >= 1),
  primary key (tournament_id, team_id),
  unique (tournament_id, position),
  foreign key (tournament_id, group_id) references tournaments(id,      group_id) on delete cascade,
  foreign key (team_id,       group_id) references tournament_teams(id, group_id) on delete cascade
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
-- QUEM PODE O QUÊ
-- =============================================================================
create or replace function is_group_member(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members
    where group_id = p_group_id and user_id = auth.uid()
  )
$$;

create or replace function is_group_admin(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members
    where group_id = p_group_id and user_id = auth.uid() and role = 'admin'
  )
$$;

-- =============================================================================
-- PORTAS DE ENTRADA
-- As duas únicas funções que uma pessoa de fora do grupo pode chamar.
-- =============================================================================

/**
 * Link do grupo: quem tem o uuid vira espectador e passa a poder ler.
 * Não rebaixa quem já é jogador ou administrador.
 */
create or replace function enter_group(p_group_id uuid)
returns groups
language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  if auth.uid() is null then
    raise exception 'É preciso uma sessão para entrar no grupo' using errcode = '28000';
  end if;

  select * into g from groups where id = p_group_id;
  if not found then
    raise exception 'Grupo não encontrado' using errcode = 'P0002';
  end if;

  insert into group_members (group_id, user_id, role)
  values (p_group_id, auth.uid(), 'viewer')
  on conflict (group_id, user_id) do nothing;

  return g;
end $$;

/** Nunca rebaixa: admin > player > viewer. */
create or replace function greatest_role(a group_role, b group_role)
returns group_role language sql immutable as $$
  select case
    when a = 'admin'  or b = 'admin'  then 'admin'::group_role
    when a = 'player' or b = 'player' then 'player'::group_role
    else 'viewer'::group_role
  end
$$;

/**
 * Link de convite.
 *   - convite de entrada (player_id nulo): cria o jogador com o nome digitado;
 *   - convite de re-associação (player_id preenchido): devolve o jogador
 *     existente, com todo o histórico, a um navegador novo.
 * Reutilizável de propósito: a mesma pessoa usa no celular e no tablet.
 */
create or replace function redeem_invite(
  p_token  uuid,
  p_name   text    default null,
  p_gender char(1) default null
)
returns group_members
language plpgsql security definer set search_path = public as $$
declare
  inv           invites;
  target_player uuid;
  membership    group_members;
begin
  if auth.uid() is null then
    raise exception 'É preciso uma sessão para usar o convite' using errcode = '28000';
  end if;

  select * into inv from invites where token = p_token;
  if not found then
    raise exception 'Convite inválido' using errcode = 'P0002';
  end if;
  if inv.revoked_at is not null then
    raise exception 'Este convite foi cancelado' using errcode = 'P0001';
  end if;
  if inv.expires_at is not null and inv.expires_at < now() then
    raise exception 'Este convite expirou' using errcode = 'P0001';
  end if;

  target_player := inv.player_id;

  -- Convite de entrada: a pessoa se cadastra digitando nome e sexo.
  if target_player is null and inv.grants_role = 'player' then
    if p_name is null or length(trim(p_name)) = 0 then
      raise exception 'Informe o nome' using errcode = '22023';
    end if;
    if p_gender is null or p_gender not in ('M', 'F') then
      raise exception 'Informe o sexo (M ou F)' using errcode = '22023';
    end if;

    -- Se já existe alguém com esse nome no grupo, reaproveita em vez de duplicar.
    select id into target_player
    from players
    where group_id = inv.group_id and lower(trim(name)) = lower(trim(p_name));

    if target_player is null then
      insert into players (group_id, name, gender)
      values (inv.group_id, trim(p_name), p_gender)
      returning id into target_player;
    end if;
  end if;

  insert into group_members (group_id, user_id, player_id, role)
  values (inv.group_id, auth.uid(), target_player, inv.grants_role)
  on conflict (group_id, user_id) do update
    set player_id = coalesce(excluded.player_id, group_members.player_id),
        role      = greatest_role(group_members.role, excluded.role)
  returning * into membership;

  return membership;
end $$;

/**
 * Cria um grupo e põe quem chamou como administrador.
 * Devolve também um convite de recuperação de administrador — o único jeito de
 * voltar a administrar o grupo se este navegador for perdido. GUARDE O LINK.
 */
create or replace function create_group(
  p_group_name  text,
  p_admin_name  text,
  p_admin_gender char(1)
)
returns table (group_id uuid, player_id uuid, recovery_token uuid)
language plpgsql security definer set search_path = public as $$
declare
  new_group  uuid;
  new_player uuid;
  recovery   uuid;
begin
  if auth.uid() is null then
    raise exception 'É preciso uma sessão para criar um grupo' using errcode = '28000';
  end if;

  insert into groups (name) values (trim(p_group_name)) returning id into new_group;

  insert into players (group_id, name, gender)
  values (new_group, trim(p_admin_name), p_admin_gender)
  returning id into new_player;

  insert into group_members (group_id, user_id, player_id, role)
  values (new_group, auth.uid(), new_player, 'admin');

  insert into invites (group_id, player_id, grants_role, label)
  values (new_group, new_player, 'admin', 'Recuperação de administrador')
  returning token into recovery;

  return query select new_group, new_player, recovery;
end $$;

-- =============================================================================
-- ROW LEVEL SECURITY
--
-- Regra geral:  LER  = ser membro do grupo   (entrou por algum link)
--               ESCREVER = ser administrador do grupo
--
-- ⚠️ Usuários anônimos recebem o papel `authenticated`, NÃO `anon`. Por isso
--    nenhuma política usa `to anon` e toda escrita passa por is_group_admin().
-- =============================================================================
alter table groups                      enable row level security;
alter table group_members               enable row level security;
alter table invites                     enable row level security;
alter table players                     enable row level security;
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

-- Tabelas de dados: mesma regra para todas.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'players','sessions','session_players','draws','draw_teams','tournaments',
    'tournament_teams','odd_player_placements','matches',
    'tournament_priority_entries','tournament_standings'
  ] loop
    execute format(
      'create policy %I on %I for select to authenticated using (is_group_member(group_id))',
      tbl || '_select_member', tbl);
    execute format(
      'create policy %I on %I for all to authenticated using (is_group_admin(group_id)) with check (is_group_admin(group_id))',
      tbl || '_write_admin', tbl);
  end loop;
end $$;

-- O grupo em si: membro lê, administrador renomeia. Criação só via create_group().
create policy groups_select_member on groups
  for select to authenticated using (is_group_member(id));
create policy groups_update_admin on groups
  for update to authenticated using (is_group_admin(id)) with check (is_group_admin(id));

-- Cada um enxerga a própria associação; o administrador enxerga a do grupo todo.
create policy group_members_select on group_members
  for select to authenticated
  using (user_id = auth.uid() or is_group_admin(group_id));
create policy group_members_write_admin on group_members
  for all to authenticated
  using (is_group_admin(group_id)) with check (is_group_admin(group_id));

-- Convites: SÓ o administrador enxerga. Quem recebe o link usa redeem_invite(),
-- que roda como security definer e não precisa de leitura na tabela.
create policy invites_admin_only on invites
  for all to authenticated
  using (is_group_admin(group_id)) with check (is_group_admin(group_id));

-- =============================================================================
-- VIEWS DE ESTATÍSTICA
-- Substituem os laços do StatisticsService: uma query em vez de N+1.
-- Herdam a segurança das tabelas de origem (security_invoker).
-- =============================================================================
create or replace view player_match_results
with (security_invoker = true) as
select
  m.id            as match_id,
  m.group_id,
  m.session_id,
  m.tournament_id,
  m.played_at,
  p.player_id,
  t.id            as team_id,
  (m.winner_id = t.id) as won
from matches m
join tournament_teams t on t.id in (m.team_a_id, m.team_b_id)
cross join lateral (values (t.player1_id), (t.player2_id)) as p(player_id);

create or replace view player_stats
with (security_invoker = true) as
select
  pl.group_id,
  pl.id   as player_id,
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
         count(*)                        as games_played,
         count(*) filter (where won)     as wins,
         count(*) filter (where not won) as losses
  from player_match_results
  group by player_id
) r on r.player_id = pl.id
left join (
  -- conta apenas sorteios SELECIONADOS (corrige a contagem triplicada, §7.6)
  select waiting_player_id as player_id, count(*) as times_waited
  from draws
  where selected and waiting_player_id is not null
  group by waiting_player_id
) w on w.player_id = pl.id;

-- Dupla identificada pelo PAR de jogadores (ordenado), não pelo id da dupla.
create or replace view team_stats
with (security_invoker = true) as
with team_matches as (
  select
    m.group_id,
    least(t.player1_id, t.player2_id)    as p1,
    greatest(t.player1_id, t.player2_id) as p2,
    (m.winner_id = t.id)                 as won
  from matches m
  join tournament_teams t on t.id in (m.team_a_id, m.team_b_id)
)
select
  group_id,
  p1 as player1_id,
  p2 as player2_id,
  count(*)                        as games_played,
  count(*) filter (where won)     as wins,
  count(*) filter (where not won) as losses,
  round(100.0 * count(*) filter (where won) / count(*))::int as win_percentage
from team_matches
group by group_id, p1, p2;
