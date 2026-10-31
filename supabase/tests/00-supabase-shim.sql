-- Recria o mínimo do ambiente Supabase para o schema rodar num Postgres nu.
create extension if not exists "pgcrypto";
create schema if not exists auth;
create table auth.users (id uuid primary key default gen_random_uuid());
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $$;

grant usage on schema public, auth to anon, authenticated;
grant select on auth.users to anon, authenticated;

-- O Supabase concede acesso às tabelas por DEFAULT PRIVILEGES, aplicados antes
-- de o schema existir. Imitar isso aqui importa: é o que faz o
-- `revoke select on players` do schema.sql ter efeito de verdade, em vez de ser
-- desfeito por um `grant all` posterior.
alter default privileges in schema public grant all on tables    to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
