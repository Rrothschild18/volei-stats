#!/usr/bin/env bash
# Sobe um Postgres descartável, aplica o schema e roda os testes.
set -euo pipefail

PORT="${PGTEST_PORT:-55432}"
BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$(dirname "$HERE")")"

WORK="$(mktemp -d)"
DATA="$WORK/pgdata"
mkdir -p "$DATA"

# O Postgres recusa rodar como root; em container, cai para um usuário comum.
AS=""
if [ "$(id -u)" = "0" ]; then
  id -u pgtest >/dev/null 2>&1 || useradd pgtest
  chmod 755 "$WORK"
  chown pgtest "$DATA"
  AS="pgtest"
fi
pg() { if [ -n "$AS" ]; then su "$AS" -c "$*"; else eval "$*"; fi; }

cleanup() { pg "$BIN/pg_ctl -D $DATA stop -m immediate" >/dev/null 2>&1 || true; }
trap cleanup EXIT

pg "$BIN/initdb -D $DATA -U postgres --auth=trust" >/dev/null
pg "$BIN/pg_ctl -D $DATA -o '-k $DATA -p $PORT -c listen_addresses=' -l $DATA/log start" >/dev/null
sleep 2

# VERBOSE=1 mostra a saída de cada asserção.
if [ -n "${VERBOSE:-}" ]; then
  run() { psql -h "$DATA" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -f "$1"; }
else
  run() { psql -h "$DATA" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -f "$1" >/dev/null; }
fi
reset_schema() {
  psql -h "$DATA" -p "$PORT" -U postgres -q \
    -c "drop schema public cascade; create schema public;" >/dev/null
}

run "$HERE/00-supabase-shim.sql"
run "$ROOT/supabase/schema.sql"
run "$HERE/01-acesso.sql"

reset_schema
run "$ROOT/supabase/schema.sql"
psql -h "$DATA" -p "$PORT" -U postgres -q -c "truncate auth.users cascade;" >/dev/null
run "$HERE/02-regras.sql"

echo "OK"
