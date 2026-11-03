#!/usr/bin/env bash
# Applies supabase/migrations to a scratch Postgres database and runs tests/supabase/rls.test.sql.
# Usage: PGHOST=... PGPORT=... PGUSER=... scripts/test-supabase-rls.sh   (any Postgres 15+; defaults to local)
set -euo pipefail
cd "$(dirname "$0")/.."
db="dvg_rls_test_$$"
createdb "$db"
trap 'dropdb --if-exists "$db"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$db" "$@"; }
run -f tests/supabase/auth_stub.sql
for f in supabase/migrations/*.sql; do run -f "$f"; done
# Results print as notices on stderr; query output is discarded.
run -f tests/supabase/rls.test.sql 2>&1 >/dev/null | sed 's/^psql:[^ ]* NOTICE:  //'
