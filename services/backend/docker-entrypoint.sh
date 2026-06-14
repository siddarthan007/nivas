#!/bin/sh
# =============================================================
# Nivas PMS Backend — Docker Entrypoint
#
# Schema sync (container start):
#   DB_MIGRATION_MODE=push   → drizzle-kit push (default, Docker dev+prod)
#   DB_MIGRATION_MODE=migrate → drizzle-kit migrate (versioned SQL in drizzle/)
#
# Supplemental boot SQL runs on every app start via src/db/migrations.ts
# (btree_gist extension, booking overlap constraint, idempotent column adds).
# =============================================================
set -e

MIGRATION_MODE="${DB_MIGRATION_MODE:-push}"
MAX_DB_WAIT="${MAX_DB_WAIT:-90}"

echo "============================================"
echo " Nivas PMS Backend — Starting up"
echo "============================================"

# ── Wait for Postgres to be ready ───────────────────────────
# Migrations need a direct Postgres connection (PgBouncer transaction mode
# is not safe for DDL). App runtime uses DATABASE_URL (may point at PgBouncer).
export MIGRATION_URL="${DATABASE_DIRECT_URL:-$DATABASE_URL}"
echo "[entrypoint] Waiting for database (${MIGRATION_URL%%@*}@…)…"
TRIES=0
until bun -e "
  import postgres from 'postgres';
  const url = process.env.MIGRATION_URL;
  if (!url) throw new Error('MIGRATION_URL is not set (set DATABASE_DIRECT_URL or DATABASE_URL)');
  const sql = postgres(url, { connect_timeout: 5, max: 1 });
  await sql\`SELECT 1\`;
  await sql.end({ timeout: 2 });
  console.log('DB ready');
"; do
  TRIES=$((TRIES + 1))
  if [ "$TRIES" -ge "$MAX_DB_WAIT" ]; then
    echo "[entrypoint] Database not reachable after ${MAX_DB_WAIT} attempts."
    echo "[entrypoint] Check DATABASE_DIRECT_URL / DATABASE_URL host (use service name 'postgres' on nivas-net, not localhost)."
    echo "[entrypoint] Ensure backend is NOT on network_mode: host while DB URLs use Docker DNS."
    exit 1
  fi
  echo "[entrypoint] DB not ready yet — retrying in 2s... (${TRIES}/${MAX_DB_WAIT})"
  sleep 2
done

echo "[entrypoint] Database is ready."

# ── Schema sync ───────────────────────────────────────────────
echo "[entrypoint] Running schema sync (mode: ${MIGRATION_MODE})..."
if [ "$MIGRATION_MODE" = "migrate" ]; then
  bun run db:migrate || {
    echo "[entrypoint] db:migrate failed — check DATABASE_URL and drizzle/ journal"
    exit 1
  }
else
  bun run db:push || {
    echo "[entrypoint] db:push failed — check DATABASE_URL and schema.ts"
    exit 1
  }
fi
echo "[entrypoint] Schema sync complete."

# ── Seed super admin (idempotent) ────────────────────────────
echo "[entrypoint] Seeding super admin..."
bun run scripts/seed-super-admin.ts || {
  echo "[entrypoint] Seed warning — continuing anyway"
}
echo "[entrypoint] Seed complete."

echo "============================================"
echo " Starting Nivas PMS API server..."
echo "============================================"

exec "$@"
