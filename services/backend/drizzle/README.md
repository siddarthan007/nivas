# Versioned SQL migrations

Docker **does not** use this folder by default.

On container start, `docker-entrypoint.sh` runs `drizzle-kit push` (schema.ts → database).

Supplemental boot SQL in `src/db/migrations.ts` runs on every API start (extensions, constraints, backfills).

To use versioned migrations instead:

```bash
DB_MIGRATION_MODE=migrate docker compose up --build
```

Or manually: `bun run db:migrate` from `services/backend`.
