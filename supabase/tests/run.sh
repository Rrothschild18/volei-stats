#!/usr/bin/env bash
# Aplica o schema num Postgres descartável e roda os testes.
#
# Usa o Postgres local se a máquina tiver os binários de servidor; senão usa
# Docker, com a mesma imagem que o `supabase start` usa. Em nenhum dos dois
# casos precisa de conta no Supabase.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$(dirname "$HERE")")"
PORT="${PGTEST_PORT:-55432}"
BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
IMAGE="${PGTEST_IMAGE:-public.ecr.aws/supabase/postgres:17.11.0.006}"

# VERBOSE=1 mostra a saída de cada asserção.
QUIET="-q"
[ -n "${VERBOSE:-}" ] || QUIET="-q -o /dev/null"

if [ -x "$BIN/initdb" ]; then
  # ---- Postgres local -------------------------------------------------------
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
  PSQL_HOST="$DATA"
elif command -v docker >/dev/null 2>&1; then
  # ---- Docker --------------------------------------------------------------
  NAME="voleistats-pgtest-$$"
  cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
  trap cleanup EXIT

  docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres \
    -p "127.0.0.1:$PORT:5432" "$IMAGE" >/dev/null

  export PGPASSWORD=postgres
  PSQL_HOST="127.0.0.1"

  # `pg_isready` responde "pronto" enquanto o entrypoint ainda roda os scripts
  # de inicialização — e depois reinicia o servidor, derrubando a conexão. Então
  # a espera é por conexões de verdade, três seguidas.
  ok=0
  for _ in $(seq 1 90); do
    if psql -h "$PSQL_HOST" -p "$PORT" -U postgres -d postgres -qtAc 'select 1' >/dev/null 2>&1; then
      ok=$((ok + 1))
      [ "$ok" -ge 3 ] && break
    else
      ok=0
    fi
    sleep 1
  done
  [ "$ok" -ge 3 ] || { echo "O Postgres do teste não subiu." >&2; exit 1; }
else
  echo "Precisa de um Postgres local (PG_BIN) ou de Docker." >&2
  exit 1
fi

psql_run() {
  # shellcheck disable=SC2086
  psql -h "$PSQL_HOST" -p "$PORT" -U postgres -d "$1" -v ON_ERROR_STOP=1 $QUIET -f "$2"
}
fresh_db() {
  psql -h "$PSQL_HOST" -p "$PORT" -U postgres -d postgres -q \
    -c "drop database if exists $1" -c "create database $1" >/dev/null
}

# Cada arquivo de teste parte de um banco limpo: um não enxerga o estado do outro.
for suite in 01-acesso 02-regras 03-brechas; do
  db="test_${suite//-/_}"
  fresh_db "$db"
  psql_run "$db" "$HERE/00-supabase-shim.sql"
  psql_run "$db" "$ROOT/supabase/schema.sql"
  psql_run "$db" "$HERE/$suite.sql"
done

echo "OK"
