#!/usr/bin/env bash
# Sobe um PostgreSQL descartável, aplica as migrações e roda tests/integrity_test.sql e tests/rls_test.sql.
# Uso: bash tests/run_db_test.sh   (precisa do PostgreSQL 15+ instalado)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(ls /usr/lib/postgresql/*/bin/initdb 2>/dev/null | sort -V | tail -1)")}"
DIR="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
RUN=""
if [ "$(id -u)" = "0" ]; then chown -R postgres "$DIR"; RUN="runuser -u postgres --"; fi
cleanup() { $RUN "$PGBIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT

$RUN "$PGBIN/initdb" -D "$DIR/data" -U postgres -A trust >/dev/null
$RUN "$PGBIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -c listen_addresses='' -k $DIR" -w start >/dev/null
P="psql -X -q -v ON_ERROR_STOP=1 -h $DIR -p $PORT -U postgres"

# Esqueleto do que o Supabase já fornece.
$P <<'SQL'
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
-- No Supabase, tabelas novas de public recebem estes privilégios por padrão; o RLS é quem restringe.
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant all on sequences to authenticated;
SQL

# Antes de cada migração, um arquivo opcional tests/fixtures/antes_<migração>.sql simula dados que já existiam.
for f in "$ROOT"/supabase/migrations/*.sql; do
  fx="$ROOT/tests/fixtures/antes_$(basename "$f")"
  [ -f "$fx" ] && $P -f "$fx"
  $P -f "$f"
done
for t in "$ROOT"/tests/integrity_test.sql "$ROOT"/tests/rls_test.sql; do
  $P -f "$t" 2>&1 | sed -e 's/^psql:[^ ]* NOTICE:  //' | grep -v '^$' | grep -v '^[0-9a-f-]\{36\}$'
done
