#!/bin/sh
# =============================================================
# Nivas PMS Backend — Docker Entrypoint
# Runs DB migrations and seeds before starting the server.
# =============================================================
set -e

echo "============================================"
echo " Nivas PMS Backend — Starting up"
echo "============================================"

# ── Wait for Postgres to be ready ───────────────────────────
echo "[entrypoint] Waiting for database..."
until bun -e "
  import postgres from 'postgres';
  const sql = postgres(process.env.DATABASE_URL);
  await sql\`SELECT 1\`;
  await sql.end();
  console.log('DB ready');
" 2>/dev/null; do
  echo "[entrypoint] DB not ready yet — retrying in 2s..."
  sleep 2
done

echo "[entrypoint] Database is ready."

# ── Run migrations (drizzle-kit push — idempotent) ───────────
echo "[entrypoint] Running database migrations..."
bun run db:push || {
  echo "[entrypoint] Migration failed — check DATABASE_URL"
  exit 1
}
echo "[entrypoint] Migrations complete."

# ── Seed super admin (idempotent) ────────────────────────────
echo "[entrypoint] Seeding super admin..."
bun run scripts/seed-super-admin.ts || {
  echo "[entrypoint] Seed warning — continuing anyway"
}
echo "[entrypoint] Seed complete."

echo "============================================"
echo " Starting Nivas PMS API server..."
echo "============================================"

# Hand off to main process (PID 1)
exec "$@"
