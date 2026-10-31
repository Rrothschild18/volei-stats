-- =============================================================================
-- VoleiStats — schema Supabase
--
-- MODELO DE ACESSO (ver docs/PLANO-SUPABASE.md §1)
--   * Sem e-mail, sem senha de verdade, sem login.
--   * Cada pessoa recebe uma sessão ANÔNIMA do Supabase, guardada no navegador.
--     É o "cookie de longa vida": sobrevive a fechar o navegador e se renova
--     sozinha enquanto a pessoa usar o site.
--   * Quem cria um vôlei é o DONO dele. Existe exatamente um dono, e ele é
--     apontado por groups.owner_player_id — então a propriedade acompanha o
--     JOGADOR, não o navegador.
--   * O dono cadastra os amigos com nome, sexo e uma DATA INICIAL comum, e
--     manda um link do vôlei. Quem abre toca no próprio nome, digita a data
--     inicial e TROCA pela data dele: a data de nascimento é uma senha.
--   * Daí em diante todo jogador faz tudo que é jogo — presença, sorteio,
--     campeonato, placar, decisões de quadra. O dono é o único a mexer em quem
--     existe (cadastro, convite) e no que desaparece (apagar, renomear).
--
-- Rode este arquivo inteiro no SQL Editor do projeto (uma vez).
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
-- O papel diz só uma coisa: se a pessoa já disse QUEM é.
--   viewer = abriu o link e ainda não reivindicou um nome
--   player = reivindicou, e a partir daí joga e escreve
-- Ser dono não é um papel: é groups.owner_player_id.
create type group_role as enum ('player', 'viewer');

-- Resultado de claim_player(). Devolve status em vez de lançar exceção: um
-- `raise` desfaria o registro da tentativa e a trava de força bruta nunca
-- contaria nada.
create type claim_result      as (ok boolean, reason text, player_id uuid);
create type tournament_status as enum ('in-progress', 'completed');
create type match_phase       as enum ('round-1', 'semifinal', 'semifinal-bye', 'final', 'third-place');
create type priority_reason   as enum ('direct-elimination', 'coin-flip-loss', 'waiting-player-not-used');
create type tiebreak_kind     as enum ('losers', 'winners');

-- =============================================================================
-- GRUPOS
-- O id do grupo é o segredo do link de leitura. Quem tem o uuid, lê.
-- =============================================================================
create table groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  -- O dono. Nulo só no instante entre inserir o grupo e inserir o jogador que
  -- o criou, dentro de create_group(); depois disso nunca mais.
  owner_player_id uuid,
  -- A senha inicial que o dono combina com o grupo: ele cadastra todo mundo
  -- com ela, e cada pessoa troca pela sua ao entrar.
  initial_birth_date date not null,
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
  -- SENHA, não dado cadastral. Nunca sai do servidor: o privilégio de coluna
  -- abaixo impede qualquer select do cliente de enxergá-la, e só
  -- claim_player() a compara.
  birth_date date not null,
  -- Falso enquanto a pessoa ainda estiver com a data inicial do grupo.
  birth_date_changed boolean not null default false,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, group_id)
);
create unique index players_name_key on players (group_id, lower(trim(name)));
create index players_group_idx on players (group_id, active);

alter table groups
  add constraint groups_owner_fk
  foreign key (owner_player_id) references players(id) on delete restrict;

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
  foreign key (player_id, group_id) references players(id, group_id),
  -- Papel de jogador sem jogador não existe.
  check (role = 'viewer' or player_id is not null)
);
create index group_members_user_idx on group_members (user_id);
create index group_members_player_idx on group_members (player_id);

-- -----------------------------------------------------------------------------
-- Convites: o link que o dono gera
--
-- O convite não carrega identidade nenhuma: ele só autoriza ENTRAR no vôlei.
-- Quem a pessoa é, ela diz depois, com nome + data (claim_player).
-- Reutilizável de propósito: um link no grupo do WhatsApp serve pra todos, e
-- a mesma pessoa usa no celular e no tablet.
-- -----------------------------------------------------------------------------
create table invites (
  token      uuid primary key default gen_random_uuid(),
  group_id   uuid not null references groups(id) on delete cascade,
  label      text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index invites_group_idx on invites (group_id);

-- -----------------------------------------------------------------------------
-- Tentativas de se reconhecer por nome + data.
-- Existe só para travar força bruta: uma data tem algumas centenas de
-- possibilidades plausíveis, o que sem limite nenhum se quebra em minutos.
-- -----------------------------------------------------------------------------
create table player_claim_attempts (
  id             bigserial primary key,
  group_id       uuid not null references groups(id)     on delete cascade,
  user_id        uuid references auth.users(id)          on delete set null,
  attempted_name text not null,
  succeeded      boolean not null,
  attempted_at   timestamptz not null default now()
);
create index player_claim_attempts_rate_idx
  on player_claim_attempts (group_id, user_id, attempted_at desc);

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

-- O encaixe do avulso (REGRAS.md §7.2): quem sobreviveu, quem saiu, e quem
-- tomou a decisão em quadra.
create table odd_player_placements (
  tournament_id        uuid primary key,
  group_id             uuid not null,
  source_team_id       uuid not null,
  encaixe_team_id      uuid not null,
  surviving_player_id  uuid not null,
  eliminated_player_id uuid not null,
  decided_by           uuid,
  decided_at           timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  check (surviving_player_id <> eliminated_player_id),
  foreign key (tournament_id,   group_id) references tournaments(id,      group_id) on delete cascade,
  foreign key (source_team_id,  group_id) references tournament_teams(id, group_id) on delete cascade,
  foreign key (encaixe_team_id, group_id) references tournament_teams(id, group_id) on delete cascade,
  foreign key (decided_by,      group_id) references players(id,          group_id)
);

-- Par-ou-ímpar de empate de diferença (REGRAS.md §9.3). Primeiro o dos
-- perdedores, depois o dos vencedores — por isso a chave inclui o tipo.
create table tiebreak_decisions (
  tournament_id  uuid not null,
  group_id       uuid not null,
  kind           tiebreak_kind not null,
  winner_team_id uuid not null,
  decided_by     uuid,
  decided_at     timestamptz not null default now(),
  primary key (tournament_id, kind),
  foreign key (tournament_id,  group_id) references tournaments(id,      group_id) on delete cascade,
  foreign key (winner_team_id, group_id) references tournament_teams(id, group_id) on delete cascade,
  foreign key (decided_by,     group_id) references players(id,          group_id)
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
  -- Quem lançou, e quem corrigiu depois. A tela mostra "corrigido por <nome>".
  reported_by      uuid,
  corrected_by     uuid,
  corrected_at     timestamptz,
  played_at        timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  check (team_a_id <> team_b_id),
  check (score_a <> score_b),     -- vôlei não tem empate
  check (score_a + score_b > 0),  -- não existe 0 x 0
  -- A trava do primeiro placar: a segunda tentativa na mesma partida bate aqui.
  unique (tournament_id, phase, team_a_id, team_b_id),
  foreign key (tournament_id, group_id) references tournaments(id,      group_id) on delete cascade,
  foreign key (session_id,    group_id) references sessions(id,         group_id) on delete cascade,
  foreign key (team_a_id,     group_id) references tournament_teams(id, group_id) on delete cascade,
  foreign key (team_b_id,     group_id) references tournament_teams(id, group_id) on delete cascade,
  foreign key (reported_by,   group_id) references players(id,          group_id),
  foreign key (corrected_by,  group_id) references players(id,          group_id)
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

-- -----------------------------------------------------------------------------
-- O vôlei nunca pode ficar sem dono.
--
-- Não precisa de gatilho de "último admin": a propriedade é uma coluna com
-- `on delete restrict`, então apagar o jogador que é dono é recusado pelo
-- próprio banco. O que o gatilho abaixo protege é o caso mais sutil — o dono
-- ser INATIVADO, o que o tiraria do ranking e da presença mas o deixaria dono.
-- -----------------------------------------------------------------------------
create or replace function prevent_inactive_owner()
returns trigger language plpgsql as $$
begin
  if not new.active and exists (
    select 1 from groups where owner_player_id = new.id
  ) then
    raise exception 'O dono do vôlei não pode ser inativado; passe o vôlei antes'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger players_owner_stays_active
  before update of active on players
  for each row execute function prevent_inactive_owner();

-- =============================================================================
-- QUEM PODE O QUÊ
--
-- Três perguntas, três funções:
--   membro   = abriu o link (lê)
--   jogador  = já disse quem é (escreve o jogo)
--   dono     = criou o vôlei, ou recebeu a propriedade (cadastro e exclusão)
-- =============================================================================
create or replace function is_group_member(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members
    where group_id = p_group_id and user_id = auth.uid()
  )
$$;

create or replace function is_group_player(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members
    where group_id = p_group_id and user_id = auth.uid() and role = 'player'
  )
$$;

-- A propriedade acompanha o JOGADOR: reivindicar o seu nome num navegador novo
-- devolve o vôlei sem precisar de link de recuperação.
create or replace function is_group_owner(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from group_members m
    join groups g on g.id = m.group_id
    where m.group_id = p_group_id
      and m.user_id  = auth.uid()
      and m.player_id is not null
      and m.player_id = g.owner_player_id
  )
$$;

/** O jogador que eu sou neste vôlei — para gravar reported_by e companhia. */
create or replace function my_player_id(p_group_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select player_id from group_members
  where group_id = p_group_id and user_id = auth.uid()
$$;

-- =============================================================================
-- PORTAS DE ENTRADA
-- As únicas funções que uma pessoa de fora do vôlei pode chamar.
-- =============================================================================

/**
 * Cria um vôlei e põe quem chamou como dono.
 *
 * `p_initial_birth_date` é a senha inicial que o dono vai combinar com o grupo:
 * ele cadastra todos com ela, e cada pessoa troca pela sua ao entrar. O dono
 * entra já com a data dele, então o nome dele nunca aparece na lista de nomes
 * por reivindicar.
 *
 * Devolve também o token do convite — o link que vai pro grupo do WhatsApp.
 */
create or replace function create_group(
  p_group_name         text,
  p_owner_name         text,
  p_owner_gender       char(1),
  p_owner_birth_date   date,
  p_initial_birth_date date
)
returns table (group_id uuid, player_id uuid, invite_token uuid)
language plpgsql security definer set search_path = public as $$
declare
  new_group  uuid;
  new_player uuid;
  new_token  uuid;
begin
  if auth.uid() is null then
    raise exception 'É preciso uma sessão para criar um vôlei' using errcode = '28000';
  end if;
  if p_owner_birth_date is null or p_initial_birth_date is null then
    raise exception 'Informe a sua data e a data inicial do grupo' using errcode = '22023';
  end if;

  insert into groups (name, initial_birth_date)
  values (trim(p_group_name), p_initial_birth_date)
  returning id into new_group;

  -- O dono já entra com a data dele própria: nada de senha compartilhada para
  -- quem manda o link.
  insert into players (group_id, name, gender, birth_date, birth_date_changed)
  values (new_group, trim(p_owner_name), p_owner_gender, p_owner_birth_date, true)
  returning id into new_player;

  update groups set owner_player_id = new_player where id = new_group;

  insert into group_members (group_id, user_id, player_id, role)
  values (new_group, auth.uid(), new_player, 'player');

  insert into invites (group_id, label) values (new_group, 'Link do vôlei')
  returning invites.token into new_token;

  return query select new_group, new_player, new_token;
end $$;

/**
 * Link do vôlei: quem tem o uuid vira espectador e passa a poder ler.
 * Não rebaixa quem já é jogador.
 */
create or replace function enter_group(p_group_id uuid)
returns groups
language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  if auth.uid() is null then
    raise exception 'É preciso uma sessão para entrar no vôlei' using errcode = '28000';
  end if;

  select * into g from groups where id = p_group_id;
  if not found then
    raise exception 'Vôlei não encontrado' using errcode = 'P0002';
  end if;

  insert into group_members (group_id, user_id, role)
  values (p_group_id, auth.uid(), 'viewer')
  on conflict (group_id, user_id) do nothing;

  return g;
end $$;

/**
 * Link de convite: autoriza entrar no vôlei, e nada mais.
 *
 * Não cria jogador nem concede identidade — quem a pessoa é, ela diz em
 * claim_player(). Reutilizável de propósito.
 */
create or replace function redeem_invite(p_token uuid)
returns groups
language plpgsql security definer set search_path = public as $$
declare inv invites;
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

  return enter_group(inv.group_id);
end $$;

/**
 * Dizer quem eu sou: NOME + DATA.
 *
 * É a porta principal, não o plano B. A data funciona como senha:
 *   * na primeira vez a pessoa usa a data inicial do grupo e é OBRIGADA a
 *     trocar pela dela na mesma chamada (p_new_birth_date);
 *   * depois de trocada, ela usa a própria data e p_new_birth_date é ignorado
 *     — é assim que o segundo aparelho entra.
 *
 * O que o torna aceitável:
 *   1. A data NUNCA sai do servidor: o privilégio de coluna impede qualquer
 *      select do cliente, e aqui só se compara palpite com armazenado.
 *   2. Só funciona para quem já tem o link do vôlei (precisa ser membro).
 *   3. Trava de força bruta: 5 erros em 15 minutos e para.
 *   4. A mensagem de erro é a mesma para nome inexistente e data errada, para
 *      não confirmar quem está no vôlei.
 *
 * NÃO concede a propriedade por si: quem é dono é quem groups.owner_player_id
 * aponta. Mas reivindicar o nome do dono devolve o vôlei a ele — é de propósito,
 * e é o que o faz sobreviver à perda do celular.
 */
create or replace function claim_player(
  p_group_id       uuid,
  p_name           text,
  p_birth_date     date,
  p_new_birth_date date default null
)
returns claim_result
language plpgsql security definer set search_path = public as $$
declare
  recent_failures int;
  target          players;
  initial         date;
begin
  if auth.uid() is null then
    raise exception 'É preciso uma sessão' using errcode = '28000';
  end if;

  -- Precisa ter chegado pelo link do vôlei.
  if not is_group_member(p_group_id) then
    raise exception 'Abra o link do vôlei primeiro' using errcode = '42501';
  end if;

  select count(*) into recent_failures
  from player_claim_attempts
  where group_id = p_group_id
    and user_id  = auth.uid()
    and not succeeded
    and attempted_at > now() - interval '15 minutes';

  if recent_failures >= 5 then
    return (false, 'rate_limited', null)::claim_result;
  end if;

  select * into target
  from players
  where group_id = p_group_id
    and lower(trim(name)) = lower(trim(coalesce(p_name, '')))
    and birth_date = p_birth_date;

  insert into player_claim_attempts (group_id, user_id, attempted_name, succeeded)
  values (p_group_id, auth.uid(), coalesce(p_name, ''), target.id is not null);

  if target.id is null then
    -- Mesmo motivo para nome inexistente e data errada: não confirma quem
    -- está no vôlei.
    return (false, 'not_found', null)::claim_result;
  end if;

  -- Primeira entrada: trocar a senha compartilhada pela própria é obrigatório.
  -- Sem isso, metade do grupo fica com a data inicial para sempre e qualquer
  -- um entra como qualquer um.
  if not target.birth_date_changed then
    if p_new_birth_date is null then
      return (false, 'new_birth_date_required', null)::claim_result;
    end if;
    select initial_birth_date into initial from groups where id = p_group_id;
    if p_new_birth_date = initial then
      return (false, 'new_birth_date_must_differ', null)::claim_result;
    end if;
    update players
    set birth_date = p_new_birth_date, birth_date_changed = true
    where id = target.id;
  end if;

  insert into group_members (group_id, user_id, player_id, role)
  values (p_group_id, auth.uid(), target.id, 'player')
  on conflict (group_id, user_id) do update
    set player_id = excluded.player_id,
        role      = 'player';

  return (true, 'ok', target.id)::claim_result;
end $$;

/**
 * O dono devolve a data de alguém para a inicial do grupo.
 *
 * É o caminho do "esqueci a minha data" / "troquei de celular e não lembro".
 * O dono nunca vê qual era: só manda zerar.
 */
create or replace function reset_player_birth_date(p_player_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare target_group uuid;
begin
  select group_id into target_group from players where id = p_player_id;
  if target_group is null then
    raise exception 'Jogador não encontrado' using errcode = 'P0002';
  end if;
  if not is_group_owner(target_group) then
    raise exception 'Só o dono do vôlei pode fazer isso' using errcode = '42501';
  end if;

  update players p
  set birth_date = g.initial_birth_date, birth_date_changed = false
  from groups g
  where p.id = p_player_id and g.id = target_group;

  -- Os aparelhos que estavam ligados a esse jogador voltam a ser espectadores:
  -- quem for reivindicar de novo passa pela troca de data outra vez.
  update group_members
  set player_id = null, role = 'viewer'
  where group_id = target_group and player_id = p_player_id;
end $$;

/** Passar o vôlei para outra pessoa. Um toque, e a propriedade é dela. */
create or replace function transfer_ownership(p_group_id uuid, p_player_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_group_owner(p_group_id) then
    raise exception 'Só o dono do vôlei pode passá-lo' using errcode = '42501';
  end if;
  if not exists (
    select 1 from players
    where id = p_player_id and group_id = p_group_id and active
  ) then
    raise exception 'Escolha um jogador ativo do vôlei' using errcode = '22023';
  end if;

  update groups set owner_player_id = p_player_id where id = p_group_id;
end $$;

-- =============================================================================
-- ROW LEVEL SECURITY
--
-- Regra geral:  LER      = ser membro (abriu o link)
--               ESCREVER = ser jogador (já disse quem é)  — o jogo é de todos
--               APAGAR   = ser dono
--               CADASTRO = ser dono (players, invites, o vôlei em si)
--
-- ⚠️ Usuários anônimos recebem o papel `authenticated`, NÃO `anon`. Por isso
--    nenhuma política usa `to anon`.
-- =============================================================================
alter table groups                      enable row level security;
alter table group_members               enable row level security;
alter table invites                     enable row level security;
alter table player_claim_attempts       enable row level security;
alter table players                     enable row level security;
alter table sessions                    enable row level security;
alter table session_players             enable row level security;
alter table draws                       enable row level security;
alter table draw_teams                  enable row level security;
alter table tournaments                 enable row level security;
alter table tournament_teams            enable row level security;
alter table odd_player_placements       enable row level security;
alter table tiebreak_decisions          enable row level security;
alter table matches                     enable row level security;
alter table tournament_priority_entries enable row level security;
alter table tournament_standings        enable row level security;

-- Tabelas do JOGO: membro lê, jogador escreve, dono apaga.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'sessions','session_players','draws','draw_teams','tournaments',
    'tournament_teams','odd_player_placements','tiebreak_decisions','matches',
    'tournament_priority_entries','tournament_standings'
  ] loop
    execute format(
      'create policy %I on %I for select to authenticated using (is_group_member(group_id))',
      tbl || '_select_member', tbl);
    execute format(
      'create policy %I on %I for insert to authenticated with check (is_group_player(group_id))',
      tbl || '_insert_player', tbl);
    execute format(
      'create policy %I on %I for update to authenticated using (is_group_player(group_id)) with check (is_group_player(group_id))',
      tbl || '_update_player', tbl);
    execute format(
      'create policy %I on %I for delete to authenticated using (is_group_owner(group_id))',
      tbl || '_delete_owner', tbl);
  end loop;
end $$;

-- Jogadores: QUEM EXISTE é do dono. Todo mundo lê — menos a coluna da senha.
create policy players_select_member on players
  for select to authenticated using (is_group_member(group_id));
create policy players_write_owner on players
  for all to authenticated
  using (is_group_owner(group_id)) with check (is_group_owner(group_id));

-- A data é senha: nenhum select do cliente pode trazê-la, nem com `select *`.
-- Só as funções security definer acima a enxergam.
--
-- Revogar a COLUNA não basta: enquanto o papel tiver select na tabela inteira
-- (e o Supabase concede isso por padrão), o privilégio de coluna é ignorado.
-- Então tira o da tabela e concede coluna a coluna. O PostgREST respeita isso:
-- `select=*` devolve só as colunas permitidas, em vez de dar erro.
revoke select on players from authenticated, anon;
grant select (id, group_id, name, gender, birth_date_changed, active,
              created_at, updated_at) on players to authenticated, anon;

-- O vôlei em si: membro lê, dono renomeia. Criação só via create_group().
create policy groups_select_member on groups
  for select to authenticated using (is_group_member(id));
create policy groups_update_owner on groups
  for update to authenticated using (is_group_owner(id)) with check (is_group_owner(id));

-- A data inicial também é senha compartilhada: ninguém a lê pelo cliente.
-- O dono a recebe uma vez, no retorno de create_group().
revoke select on groups from authenticated, anon;
grant select (id, name, owner_player_id, created_at) on groups to authenticated, anon;

-- Cada um enxerga a própria associação; o dono enxerga a do vôlei todo.
create policy group_members_select on group_members
  for select to authenticated
  using (user_id = auth.uid() or is_group_owner(group_id));
create policy group_members_write_owner on group_members
  for all to authenticated
  using (is_group_owner(group_id)) with check (is_group_owner(group_id));

-- Tentativas de reconhecimento: só o dono enxerga (para notar abuso).
-- A escrita acontece dentro de claim_player(), que é security definer.
create policy claim_attempts_owner_only on player_claim_attempts
  for select to authenticated using (is_group_owner(group_id));

-- Convites: SÓ o dono enxerga. Quem recebe o link usa redeem_invite(), que
-- roda como security definer e não precisa de leitura na tabela.
create policy invites_owner_only on invites
  for all to authenticated
  using (is_group_owner(group_id)) with check (is_group_owner(group_id));

-- =============================================================================
-- VIEWS
-- Herdam a segurança das tabelas de origem (security_invoker).
-- =============================================================================

/**
 * A primeira tela do app: os vôleis de quem está olhando, com o papel, a
 * sessão de hoje e o tamanho do grupo. Uma requisição, não N.
 */
create or replace view my_groups
with (security_invoker = true) as
select
  g.id,
  g.name,
  m.role,
  m.player_id,
  (m.player_id is not null and m.player_id = g.owner_player_id) as is_owner,
  (select s.id   from sessions s where s.group_id = g.id and s.date = current_date) as today_session_id,
  (select count(*) from players p where p.group_id = g.id and p.active)             as player_count,
  (select max(s.date) from sessions s where s.group_id = g.id)                      as last_session_date
from group_members m
join groups g on g.id = m.group_id
where m.user_id = auth.uid();

/**
 * Os nomes que ainda ninguém reivindicou — é o que a tela do convite mostra.
 * Quem já entrou sai da lista, o que fecha a janela em que a data inicial
 * compartilhada vale para qualquer um.
 *
 * É função, e não view, porque a conta precisa enxergar TODAS as associações
 * do vôlei. Numa view com security_invoker, quem pergunta só vê a própria
 * linha de group_members — e então todo mundo pareceria disponível, inclusive
 * o dono. Como contrapartida de ser security definer, exige ser membro.
 */
create or replace function unclaimed_players(p_group_id uuid)
returns table (id uuid, name text, gender char(1))
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.gender
  from players p
  where p.group_id = p_group_id
    and p.active
    and is_group_member(p_group_id)
    and not exists (select 1 from group_members m where m.player_id = p.id)
  order by lower(p.name)
$$;

-- -----------------------------------------------------------------------------
-- Estatística: substituem os laços do StatisticsService por uma query.
-- -----------------------------------------------------------------------------
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
