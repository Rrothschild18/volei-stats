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
  -- A SENHA DO GRUPO: o que o dono combina e manda no zap junto com o código.
  -- Texto simples escolhido por ele ("volei99"), porque é para ser ditado — uma
  -- data era difícil de falar e fácil de confundir com a data de alguém.
  --
  -- Guardada como hash, e não como está escrita: ninguém precisa lê-la de volta
  -- (o dono a sabe), então guardá-la em claro só criaria uma forma de vazá-la.
  join_password_hash text not null,
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
  -- A CHAVE PESSOAL, não dado cadastral. Nunca sai do servidor: o privilégio
  -- de coluna abaixo impede qualquer select do cliente de enxergá-la.
  --
  -- NULA enquanto ninguém reivindicou este nome. É o que distingue as duas
  -- portas: com ela vazia, entra-se com a senha do GRUPO e a data vira a sua;
  -- com ela preenchida, entra-se com a SUA data, e a senha do grupo não serve
  -- mais para este nome — senão quem tem o código assumiria quem já entrou.
  birth_date date,
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
/**
 * Um código curto que dá para ditar no telefone.
 *
 * O alfabeto tira O/0 e I/1: o código nasce para ser lido em voz alta e
 * digitado errado. São 32 símbolos em 6 casas, ~1 bilhão de combinações — e é
 * a entropia, não a trava de tentativas, que torna adivinhar inútil (ver
 * redeem_invite_code).
 */
create or replace function new_invite_code()
returns text
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := '';
    for _ in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from invites where code = candidate);
  end loop;
  return candidate;
end $$;

create table invites (
  token      uuid primary key default gen_random_uuid(),
  group_id   uuid not null references groups(id) on delete cascade,
  -- O que a pessoa digita. O gerado tem 6 casas; o dono pode trocar por um
  -- escolhido, mais longo ("TESTE-VOLEI"), desde que ninguém mais o use.
  code       text not null unique default new_invite_code()
               constraint invites_code_shape check (code ~ '^[A-Z0-9][A-Z0-9-]{2,23}$'),
  label      text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index invites_group_idx on invites (group_id);

-- O código é comparado como foi guardado, e é guardado de um jeito só: sem
-- espaço nas pontas e em maiúsculas. Assim "teste-volei " entra.
create or replace function normalize_invite_code()
returns trigger
language plpgsql set search_path = public as $$
begin
  new.code := upper(trim(new.code));
  return new;
end $$;

create trigger invites_normalize_code
  before insert or update of code on invites
  for each row execute function normalize_invite_code();

-- -----------------------------------------------------------------------------
-- Tentativas de resgatar um convite por código.
--
-- Serve para barrar um laço bobo varrendo códigos. É honestamente uma segunda
-- linha: a sessão anônima nova é grátis, então a trava por sessão se contorna.
-- O que de fato protege é o tamanho do espaço de códigos — e o fato de que
-- acertar um só rende VISITANTE, nunca identidade (essa exige nome + data).
-- -----------------------------------------------------------------------------
create table invite_redeem_attempts (
  id             bigserial primary key,
  -- Sem chave estrangeira para `auth.users` DE PROPÓSITO. Isto é registro de
  -- tentativa, não vínculo: a integridade referencial não compra nada aqui e
  -- custa disponibilidade. Com a chave, uma sessão cujo usuário não existe mais
  -- — o navegador guarda o JWT, e o usuário sumiu num `db reset` — derrubava a
  -- ENTRADA no vôlei com um erro de banco cru, em vez de a pessoa só não
  -- conseguir entrar.
  user_id        uuid,
  attempted_code text not null,
  succeeded      boolean not null,
  attempted_at   timestamptz not null default now()
);
create index invite_redeem_attempts_rate_idx
  on invite_redeem_attempts (user_id, attempted_at desc);

-- -----------------------------------------------------------------------------
-- Tentativas de se reconhecer por nome + data.
-- Existe só para travar força bruta: uma data tem algumas centenas de
-- possibilidades plausíveis, o que sem limite nenhum se quebra em minutos.
-- -----------------------------------------------------------------------------
create table player_claim_attempts (
  id             bigserial primary key,
  group_id       uuid not null references groups(id)     on delete cascade,
  -- Sem chave estrangeira para `auth.users`, pelo mesmo que
  -- `invite_redeem_attempts`: é registro de tentativa, e uma sessão órfã deve
  -- falhar em entrar, não quebrar a tela.
  user_id        uuid,
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
-- Um dia tem UMA sessão por vôlei. O app já assume isso; sem a constraint,
-- dois jogadores abrindo a presença ao mesmo tempo criavam duas.
create unique index sessions_group_date_key on sessions (group_id, date);
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
  -- Os selos da proposta ("mesmo sexo", "dupla repetida", "tem prioridade").
  -- Ficam em jsonb de propósito: são o que o gerador ACHOU no momento do
  -- sorteio, e a tela os mostra do jeito que foram vistos. Normalizá-los daria
  -- uma tabela que nunca é consultada por nada além de desenhar o card.
  badges            jsonb not null default '[]'::jsonb,
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
  -- As duplas que empataram, na ordem em que foram apresentadas. Não é enfeite:
  -- a leitura da rodada 1 (src/app/core/rules/round-1-outcome.ts) só aplica a
  -- decisão ao par exato que a gerou, então sem esta lista o desempate se perde
  -- ao recarregar a tela.
  team_ids       uuid[] not null default '{}',
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

-- -----------------------------------------------------------------------------
-- Quem lançou e quem corrigiu são gravados pelo BANCO, não pelo cliente.
--
-- Deixar todo mundo corrigir placar só é aceitável porque fica registrado quem
-- foi (docs/PLANO-SUPABASE.md §1). Como coluna comum, qualquer jogador mudava o
-- placar deixando corrected_by nulo, ou apontando para outra pessoa — e a
-- justificativa inteira caía.
-- -----------------------------------------------------------------------------
create or replace function stamp_match_author()
returns trigger language plpgsql security definer set search_path = public as $$
declare me uuid;
begin
  me := my_player_id(new.group_id);

  if tg_op = 'INSERT' then
    new.reported_by := coalesce(me, new.reported_by);
    return new;
  end if;

  -- Mexeu no placar: é correção, e tem autor.
  if new.score_a <> old.score_a or new.score_b <> old.score_b then
    new.corrected_by := coalesce(me, new.corrected_by);
    new.corrected_at := now();
  else
    new.corrected_by := old.corrected_by;
    new.corrected_at := old.corrected_at;
  end if;

  new.reported_by := old.reported_by;
  return new;
end $$;

create trigger matches_stamp_author
  before insert or update on matches
  for each row execute function stamp_match_author();

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

-- -----------------------------------------------------------------------------
-- Inativar alguém tira o acesso dele.
--
-- Sem isto, quem saiu do vôlei continuava escrevendo presença, sorteio e placar:
-- a linha de group_members sobrevivia à inativação, e claim_player o deixaria
-- voltar com a própria data.
-- -----------------------------------------------------------------------------
create or replace function drop_access_when_inactive()
returns trigger language plpgsql as $$
begin
  if old.active and not new.active then
    update group_members
    set player_id = null, role = 'viewer'
    where player_id = new.id;
  end if;
  return new;
end $$;

create trigger players_inactive_drops_access
  after update of active on players
  for each row execute function drop_access_when_inactive();

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
 * `p_join_password` é a senha que o dono combina com o grupo: ela vai no zap
 * junto com o código, e serve para cada pessoa reivindicar o SEU nome uma vez.
 * O dono entra já com a data dele, então o nome dele nunca aparece na lista de
 * nomes por reivindicar.
 *
 * Devolve também o token do convite — o link que vai pro grupo do WhatsApp.
 */
create or replace function create_group(
  p_group_name         text,
  p_owner_name         text,
  p_owner_gender       char(1),
  p_owner_birth_date   date,
  p_join_password      text
)
returns table (group_id uuid, player_id uuid, invite_token uuid, invite_code text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  new_group  uuid;
  new_player uuid;
  new_token  uuid;
  new_code   text;
begin
  if auth.uid() is null then
    raise exception 'É preciso uma sessão para criar um vôlei' using errcode = '28000';
  end if;
  if p_owner_birth_date is null then
    raise exception 'Informe a sua data de nascimento' using errcode = '22023';
  end if;
  if length(coalesce(trim(p_join_password), '')) < 4 then
    raise exception 'A senha do grupo precisa de pelo menos 4 caracteres'
      using errcode = '22023';
  end if;

  insert into groups (name, join_password_hash)
  values (trim(p_group_name), crypt(trim(p_join_password), gen_salt('bf')))
  returning id into new_group;

  -- O dono já entra com a data dele: ele não usa a senha do grupo, e o nome
  -- dele não fica na lista de nomes por reivindicar.
  insert into players (group_id, name, gender, birth_date)
  values (new_group, trim(p_owner_name), p_owner_gender, p_owner_birth_date)
  returning id into new_player;

  update groups set owner_player_id = new_player where id = new_group;

  insert into group_members (group_id, user_id, player_id, role)
  values (new_group, auth.uid(), new_player, 'player');

  insert into invites (group_id, label) values (new_group, 'Link do vôlei')
  returning invites.token, invites.code into new_token, new_code;

  return query select new_group, new_player, new_token, new_code;
end $$;

/**
 * O dono cadastra alguém no vôlei.
 *
 * É função, e não insert do cliente, por uma razão só: `players.birth_date` é a
 * senha de primeiro acesso, e quem a define é o banco, copiando a data inicial
 * do grupo. Se o cadastro fosse um insert comum, o dono escolheria a data de
 * cada um — e o privilégio de escrever naquela coluna teria de existir.
 */
create or replace function add_player(
  p_group_id uuid,
  p_name     text,
  p_gender   char(1)
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare new_player uuid;
begin
  if not is_group_owner(p_group_id) then
    raise exception 'Só o dono cadastra gente no vôlei' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'O jogador precisa de um nome' using errcode = '22023';
  end if;

  -- Nasce SEM chave: ela é a data que a própria pessoa informa ao reivindicar
  -- o nome. Quem cadastra não escolhe a chave de ninguém.
  insert into players (group_id, name, gender)
  values (p_group_id, trim(p_name), p_gender)
  returning id into new_player;

  return new_player;
end $$;

/**
 * Vira espectador do vôlei: lê, e não escreve.
 *
 * ⚠️ INTERNA. O privilégio de EXECUTE é revogado abaixo, e a única porta de
 * fora é redeem_invite(). Se o cliente pudesse chamar isto com um uuid de
 * grupo, revogar um convite não trancaria ninguém: o uuid é permanente.
 *
 * Também não devolve `groups`: privilégio de COLUNA não se aplica aos campos
 * de um composto devolvido por função security definer, e o composto carregaria
 * `join_password_hash` — o hash da senha do grupo — para quem chamasse.
 */
create or replace function enter_group(p_group_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'É preciso uma sessão para entrar no vôlei' using errcode = '28000';
  end if;

  if not exists (select 1 from groups where id = p_group_id) then
    raise exception 'Vôlei não encontrado' using errcode = 'P0002';
  end if;

  insert into group_members (group_id, user_id, role)
  values (p_group_id, auth.uid(), 'viewer')
  on conflict (group_id, user_id) do nothing;
end $$;

-- Só redeem_invite() entra. O grant implícito a PUBLIC é o que precisa sair:
-- revogar de `authenticated` sozinho não tira nada.
revoke execute on function enter_group(uuid) from public, anon, authenticated;

/**
 * Em que estado o convite está. Interna: recebe a LINHA, que carrega o token.
 */
create or replace function invite_state(inv invites)
returns text
language sql stable set search_path = public as $$
  select case
    when inv.token is null                                      then 'not_found'
    when inv.revoked_at is not null                             then 'revoked'
    when inv.expires_at is not null and inv.expires_at < now()  then 'expired'
    else 'ok'
  end
$$;

revoke execute on function invite_state(invites) from public, anon, authenticated;

/**
 * Entra no vôlei, achado o convite — pelo link ou pelo código.
 *
 * ⚠️ INTERNA, por um motivo diferente de enter_group(): ela recebe a LINHA do
 * convite, e um composto de `invites` carrega o token. Deixá-la aberta daria ao
 * cliente um jeito de passar uma linha inventada.
 *
 * Quem checa o estado do convite é quem chama: aqui já se sabe que ele vale.
 */
create or replace function accept_invite(inv invites)
returns table (group_id uuid, group_name text)
language plpgsql security definer set search_path = public as $$
begin
  perform enter_group(inv.group_id);

  -- Devolve só o que a tela precisa: nada de composto de `groups`.
  return query select g.id, g.name from groups g where g.id = inv.group_id;
end $$;

revoke execute on function accept_invite(invites) from public, anon, authenticated;

/**
 * Link de convite: autoriza entrar no vôlei, e nada mais.
 *
 * Não cria jogador nem concede identidade — quem a pessoa é, ela diz em
 * claim_player(). Reutilizável de propósito.
 *
 * Esta pode lançar exceção à vontade: o caminho do link não registra tentativa
 * nenhuma, então não há nada para um `raise` desfazer.
 */
create or replace function redeem_invite(p_token uuid)
returns table (group_id uuid, group_name text)
language plpgsql security definer set search_path = public as $$
declare
  inv   invites;
  state text;
begin
  if auth.uid() is null then
    raise exception 'É preciso uma sessão para usar o convite' using errcode = '28000';
  end if;

  select * into inv from invites where token = p_token;
  state := invite_state(inv);

  if state = 'not_found' then
    raise exception 'Convite inválido' using errcode = 'P0002';
  elsif state = 'revoked' then
    raise exception 'Este convite foi cancelado' using errcode = 'P0001';
  elsif state = 'expired' then
    raise exception 'Este convite expirou' using errcode = 'P0001';
  end if;

  return query select * from accept_invite(inv);
end $$;

/**
 * O mesmo convite, digitado em vez de clicado.
 *
 * Devolve MOTIVO em vez de lançar exceção, e isso não é estilo: um `raise`
 * desfaz a transação, e com ela o registro da tentativa que acabou de ser
 * gravado — a trava de força bruta então contaria sempre zero e nunca pegaria
 * ninguém. É a mesma razão de claim_player() devolver status, e foi escrevendo
 * esta função que eu caí na armadilha que aquela documenta.
 *
 * `reason` é 'ok', 'not_found', 'revoked', 'expired' ou 'rate_limited'. A tela
 * não distingue 'not_found' de vôlei inexistente: o código não conta se há um
 * vôlei do outro lado.
 */
create or replace function redeem_invite_code(p_code text)
returns table (group_id uuid, group_name text, reason text)
language plpgsql security definer set search_path = public as $$
declare
  inv             invites;
  state           text;
  recent_failures int;
  wanted          text := upper(trim(coalesce(p_code, '')));
begin
  if auth.uid() is null then
    raise exception 'É preciso uma sessão para usar o convite' using errcode = '28000';
  end if;

  select count(*) into recent_failures
  from invite_redeem_attempts
  where user_id = auth.uid()
    and not succeeded
    and attempted_at > now() - interval '15 minutes';

  if recent_failures >= 10 then
    return query select null::uuid, null::text, 'rate_limited'::text;
    return;
  end if;

  select * into inv from invites where code = wanted;
  state := invite_state(inv);

  insert into invite_redeem_attempts (user_id, attempted_code, succeeded)
  values (auth.uid(), wanted, state = 'ok');

  if state <> 'ok' then
    return query select null::uuid, null::text, state;
    return;
  end if;

  return query select a.group_id, a.group_name, 'ok'::text from accept_invite(inv) a;
end $$;

/**
 * Dizer quem eu sou, da PRIMEIRA vez: nome + senha do grupo + a sua data.
 *
 * A senha do grupo é a que o dono mandou no zap junto com o código; a data que
 * você informa aqui vira a SUA chave, e é com ela que você entra num aparelho
 * novo depois.
 *
 * Só serve para nome ainda sem dono (`birth_date is null`). Depois que alguém
 * reivindicou, a senha do grupo não abre mais aquele nome — senão qualquer um
 * com o código assumiria quem já entrou.
 *
 * O que o torna aceitável:
 *   1. Nem a senha do grupo nem a data saem do servidor: a senha é guardada
 *      como hash e a data tem o privilégio de coluna revogado.
 *   2. Só funciona para quem já tem o link do vôlei (precisa ser membro).
 *   3. Trava de força bruta: 5 erros em 15 minutos e para.
 *   4. A mensagem de erro é a mesma para nome inexistente e senha errada, para
 *      não confirmar quem está no vôlei.
 *
 * NÃO concede a propriedade por si: quem é dono é quem groups.owner_player_id
 * aponta. Mas reivindicar o nome do dono devolve o vôlei a ele — é de propósito,
 * e é o que o faz sobreviver à perda do celular.
 */
create or replace function claim_player(
  p_group_id   uuid,
  p_name       text,
  p_password   text,
  p_birth_date date
)
returns claim_result
language plpgsql security definer set search_path = public, extensions as $$
declare
  target          players;
  recent_failures int;
  senha_confere   boolean;
begin
  if auth.uid() is null then
    raise exception 'É preciso uma sessão' using errcode = '28000';
  end if;
  if not is_group_member(p_group_id) then
    raise exception 'Abra o link do vôlei primeiro' using errcode = '42501';
  end if;
  if p_birth_date is null then
    return (false, 'birth_date_required', null)::claim_result;
  end if;

  -- A trava conta por PESSOA TENTADA, não só por sessão: uma sessão anônima
  -- nova é grátis (é a própria porta de entrada do modelo) e zerava o contador.
  select count(*) into recent_failures
  from player_claim_attempts
  where group_id = p_group_id
    and not succeeded
    and attempted_at > now() - interval '15 minutes'
    and (
      user_id = auth.uid()
      or lower(trim(attempted_name)) = lower(trim(coalesce(p_name, '')))
    );

  if recent_failures >= 5 then
    return (false, 'rate_limited', null)::claim_result;
  end if;

  select (join_password_hash = crypt(coalesce(p_password, ''), join_password_hash))
  into senha_confere
  from groups where id = p_group_id;

  select * into target
  from players
  where group_id = p_group_id
    and active
    and birth_date is null
    and lower(trim(name)) = lower(trim(coalesce(p_name, '')));

  insert into player_claim_attempts (group_id, user_id, attempted_name, succeeded)
  values (p_group_id, auth.uid(), coalesce(p_name, ''),
          coalesce(senha_confere, false) and target.id is not null);

  -- Mesmo motivo para nome que não existe, nome já reivindicado e senha errada:
  -- não confirma quem está no vôlei nem quem já entrou.
  if not coalesce(senha_confere, false) or target.id is null then
    return (false, 'not_found', null)::claim_result;
  end if;

  update players set birth_date = p_birth_date where id = target.id;

  insert into group_members (group_id, user_id, player_id, role)
  values (p_group_id, auth.uid(), target.id, 'player')
  on conflict (group_id, user_id) do update
    set player_id = excluded.player_id,
        role      = 'player';

  return (true, 'ok', target.id)::claim_result;
end $$;

/**
 * Dizer quem eu sou NUM APARELHO NOVO: nome + a sua data.
 *
 * É a porta de quem já reivindicou o nome e está no tablet, ou trocou de
 * celular. A senha do grupo não serve aqui: ela abre um nome uma vez só.
 */
create or replace function claim_player_again(
  p_group_id   uuid,
  p_name       text,
  p_birth_date date
)
returns claim_result
language plpgsql security definer set search_path = public as $$
declare
  target          players;
  recent_failures int;
begin
  if auth.uid() is null then
    raise exception 'É preciso uma sessão' using errcode = '28000';
  end if;
  if not is_group_member(p_group_id) then
    raise exception 'Abra o link do vôlei primeiro' using errcode = '42501';
  end if;

  select count(*) into recent_failures
  from player_claim_attempts
  where group_id = p_group_id
    and not succeeded
    and attempted_at > now() - interval '15 minutes'
    and (
      user_id = auth.uid()
      or lower(trim(attempted_name)) = lower(trim(coalesce(p_name, '')))
    );

  if recent_failures >= 5 then
    return (false, 'rate_limited', null)::claim_result;
  end if;

  select * into target
  from players
  where group_id = p_group_id
    and active
    and birth_date is not null
    and birth_date = p_birth_date
    and lower(trim(name)) = lower(trim(coalesce(p_name, '')));

  insert into player_claim_attempts (group_id, user_id, attempted_name, succeeded)
  values (p_group_id, auth.uid(), coalesce(p_name, ''), target.id is not null);

  if target.id is null then
    return (false, 'not_found', null)::claim_result;
  end if;

  insert into group_members (group_id, user_id, player_id, role)
  values (p_group_id, auth.uid(), target.id, 'player')
  on conflict (group_id, user_id) do update
    set player_id = excluded.player_id,
        role      = 'player';

  return (true, 'ok', target.id)::claim_result;
end $$;

/**
 * Trocar o PRÓPRIO nome.
 *
 * Existe porque o dono cadastra o nome grosso — ele está digitando doze nomes
 * de cabeça — e é a própria pessoa quem sabe como quer ser chamada. Num vôlei
 * com Raul, Raphael e Rafael, é assim que viram Raul, Rapha e Rafa.
 *
 * É função, e não um `update` com política de "eu mesmo", por uma razão: o
 * privilégio de coluna em `players` vale para a tabela toda, e liberar `update`
 * ao jogador liberaria também `active` — ele poderia se inativar e, pelo gatilho
 * `players_inactive_drops_access`, derrubar o próprio acesso sem entender por
 * quê. Aqui a superfície é exatamente "o meu nome".
 */
create or replace function rename_me(p_group_id uuid, p_name text)
returns void
language plpgsql security definer set search_path = public as $$
declare me uuid;
begin
  me := my_player_id(p_group_id);
  if me is null then
    raise exception 'Diga quem você é antes de trocar o nome' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'O nome não pode ficar vazio' using errcode = '22023';
  end if;

  -- Nome repetido no vôlei bate no índice único e chega ao cliente como 23505.
  update players set name = trim(p_name) where id = me;
end $$;

/**
 * Trocar a PRÓPRIA data, sabendo a atual.
 *
 * A data atual é exigida por um motivo concreto: a sessão é a única credencial,
 * e um celular emprestado já está dentro. Sem pedir a data velha, quem pegasse
 * o aparelho trocaria a chave e trancaria a pessoa fora dos aparelhos dela —
 * porque é a data que reivindica o nome num aparelho novo.
 *
 * Devolve MOTIVO em vez de lançar exceção, pelo mesmo que `claim_player`: um
 * `raise` desfaz a transação e com ela o registro da tentativa, e a trava de
 * força bruta nunca contaria nada.
 */
create or replace function change_my_birth_date(
  p_group_id uuid,
  p_current  date,
  p_new      date
)
returns text
language plpgsql security definer set search_path = public as $$
declare
  me              players;
  recent_failures int;
begin
  select * into me from players where id = my_player_id(p_group_id);
  if me.id is null then
    raise exception 'Diga quem você é antes de trocar a data' using errcode = '42501';
  end if;
  if p_new is null then
    raise exception 'Informe a data nova' using errcode = '22023';
  end if;

  select count(*) into recent_failures
  from player_claim_attempts
  where group_id = p_group_id
    and user_id = auth.uid()
    and not succeeded
    and attempted_at > now() - interval '15 minutes';

  if recent_failures >= 5 then
    return 'rate_limited';
  end if;

  if me.birth_date is distinct from p_current then
    insert into player_claim_attempts (group_id, user_id, attempted_name, succeeded)
    values (p_group_id, auth.uid(), me.name, false);
    return 'wrong_current';
  end if;

  update players set birth_date = p_new where id = me.id;
  return 'ok';
end $$;

/**
 * O dono troca a senha do grupo.
 *
 * É o caminho de "entrou gente que não devia": troca a senha, manda a nova no
 * zap. Quem já reivindicou um nome continua dentro — a senha do grupo só abre
 * nome que ainda não tem dono.
 */
create or replace function set_join_password(p_group_id uuid, p_password text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not is_group_owner(p_group_id) then
    raise exception 'Só o dono do vôlei troca a senha' using errcode = '42501';
  end if;
  if length(coalesce(trim(p_password), '')) < 4 then
    raise exception 'A senha do grupo precisa de pelo menos 4 caracteres'
      using errcode = '22023';
  end if;

  update groups
  set join_password_hash = crypt(trim(p_password), gen_salt('bf'))
  where id = p_group_id;
end $$;

/**
 * O dono devolve um nome à lista de quem ainda não entrou.
 *
 * É o caminho do "esqueci a minha data" / "troquei de celular e não lembro".
 * O dono nunca vê qual era: ele apaga a chave, e a pessoa entra de novo como
 * entrou da primeira vez — senha do grupo e uma data nova.
 *
 * Derruba junto os aparelhos ligados àquele jogador. Isso é o ponto, não um
 * efeito colateral: se a pessoa pediu reset porque perdeu o celular, deixar o
 * celular perdido logado seria o contrário do pedido.
 */
create or replace function reset_player_access(p_player_id uuid)
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

  update players set birth_date = null where id = p_player_id;

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
  -- Tem de ser alguém que JÁ entrou: passar para um nome não reivindicado
  -- deixaria o vôlei sem dono efetivo, e quem reivindicasse aquele nome com a
  -- senha do grupo assumiria tudo.
  if not exists (
    select 1
    from players p
    join group_members m on m.player_id = p.id
    where p.id = p_player_id and p.group_id = p_group_id and p.active
  ) then
    raise exception 'Passe o vôlei para alguém que já entrou nele' using errcode = '22023';
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
alter table invite_redeem_attempts      enable row level security;
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

-- Tabelas do JOGO: membro lê, jogador escreve.
--
-- Apagar se divide em dois, e confundir os dois foi um erro:
--
--   DONO — as coisas que alguém destrói de propósito: a sessão, o sorteio, o
--          campeonato, a partida, a dupla do campeonato. São as que levam
--          história embora, e a dupla em particular levaria as partidas por
--          cascata — o que daria ao jogador uma porta lateral para apagar
--          placar.
--
--   JOGADOR — as linhas que existem só como parte do que ele já pode escrever,
--             e que o app REESCREVE jogando: tirar alguém da presença, regravar
--             as duplas de uma proposta, a classificação, as prioridades, o
--             encaixe e o desempate. Com elas trancadas, desmarcar um nome não
--             dava erro — não fazia nada —, e regravar a classificação batia em
--             chave repetida porque o apagar anterior não apagara nada.
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
  end loop;

  foreach tbl in array array[
    'sessions','draws','tournaments','tournament_teams','matches'
  ] loop
    execute format(
      'create policy %I on %I for delete to authenticated using (is_group_owner(group_id))',
      tbl || '_delete_owner', tbl);
  end loop;

  foreach tbl in array array[
    'session_players','draw_teams','odd_player_placements','tiebreak_decisions',
    'tournament_priority_entries','tournament_standings'
  ] loop
    execute format(
      'create policy %I on %I for delete to authenticated using (is_group_player(group_id))',
      tbl || '_delete_player', tbl);
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
grant select (id, group_id, name, gender, active,
              created_at, updated_at) on players to authenticated, anon;

-- E o mesmo vale para ESCRITA: sem isto o dono apagava a chave de alguém com um
-- `update` comum, por fora de reset_player_access() — que existe justamente
-- para derrubar os aparelhos da vítima junto. Assim ela ficaria logada sem
-- saber que a chave dela sumiu.
revoke update on players from authenticated, anon;
grant update (name, gender, active) on players to authenticated, anon;

-- E não insere: cadastrar é add_player(), que copia a data inicial do grupo.
-- Com insert liberado, quem cadastra escolheria a senha de primeiro acesso de
-- cada pessoa — e poderia cadastrar um nome já sabendo a data dele.
revoke insert on players from authenticated, anon;

-- O vôlei em si: membro lê, dono renomeia. Criação só via create_group().
create policy groups_select_member on groups
  for select to authenticated using (is_group_member(id));
create policy groups_update_owner on groups
  for update to authenticated using (is_group_owner(id)) with check (is_group_owner(id));

-- A senha do grupo não sai pelo cliente — nem como hash. Quem a sabe é o dono,
-- que a escolheu; ninguém precisa lê-la de volta.
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

-- Tentativas de resgate por código: ninguém lê pelo cliente. Não tem política
-- de propósito — não é informação de ninguém, e saber quais códigos foram
-- tentados é justamente o que não se quer dar.

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
