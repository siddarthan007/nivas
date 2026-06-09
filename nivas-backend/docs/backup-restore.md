# Database backups & restore

## What a backup is
A `pg_dump -Fc` file (PostgreSQL custom format): **compressed and fully
restorable**. Stored in a private object-storage bucket (`MINIO_BACKUP_BUCKET`),
only the newest `BACKUP_KEEP` (default 3) kept. Download links are presigned and
valid for **12 hours**, and emailed to all super-admins when a backup runs.

## Creating backups
- **Manual:** SaaS Admin → Settings → Database Backups → **Back up now**.
- **Automatic:** toggle on + choose Daily/Weekly. A cron checks daily at 02:00 and
  runs only when due.

## Restoring (manual — by design)

Restore is **not** exposed in the app. Overwriting a live production database is a
high-risk operation that should be done deliberately, in a maintenance window, by
an operator with database access. Download the backup from the app, then restore
with the PostgreSQL 16 client:

```bash
# Restore into an existing (empty or to-be-overwritten) database
pg_restore --clean --if-exists --no-owner --no-acl \
  -d "postgres://USER:PASS@HOST:5432/nivas_db" backup-2026-06-09T....dump

# Or create a fresh database first
createdb -h HOST -U USER nivas_db
pg_restore --no-owner --no-acl -d "postgres://USER:PASS@HOST:5432/nivas_db" backup-....dump
```

## Requirements
- `pg_dump` / `pg_restore` must be on PATH where the backend runs. The production
  image installs **postgresql-client-16** (matches the `postgres:16` server).
  pg_dump must be **>=** the server's major version.
- `MINIO_PUBLIC_URL` must be set in production so download links resolve from the
  browser (a presigned URL is signed for a specific host).
