# Nivas PMS — Production Deployment & Ops

Operational runbook for the load/uptime hardening. Code-side work (caching, push, rate-limit, step-up, health, graceful shutdown, image compression, WS fan-out) is already in the app — this covers how to **run** it.

## Stack (docker-compose.prod.yml)
- `postgres` — PostgreSQL 16 (internal only, healthcheck)
- `redis` — cache + rate-limit + auth cache + WS fan-out (256mb, `allkeys-lru`, AOF)
- `backend` — Elysia/Bun, `/health` healthcheck, 512M limit, **scalable**
- `frontend` — nginx: SPA + `/api` + `/ws` proxy, gzip, 1y static cache, re-resolves `backend` for load-balancing

## Required env (.env next to the compose file)
```
POSTGRES_PASSWORD=<strong>
REDIS_PASSWORD=<strong>
JWT_SECRET=<32+ chars, NOT the dev default>
ALLOWED_ORIGINS=https://yourdomain
GUEST_PORTAL_URL=https://yourdomain/guest
# optional: JWT_EXPIRY, FRONTEND_PORT, SUPER_ADMIN_*
```
The compose fails fast if `POSTGRES_PASSWORD` / `REDIS_PASSWORD` / `JWT_SECRET` are unset.

## Run
```
docker compose -f docker-compose.prod.yml up --build -d
```

## Scale the backend (zero-downtime, multi-instance)
```
docker compose -f docker-compose.prod.yml up -d --scale backend=3
```
- nginx re-resolves `backend` via Docker DNS each request → round-robins across replicas.
- Limits/auth/rate-limit are shared via **Redis**, so they're correct across replicas.
- WebSocket events fan out across replicas via **Redis pub/sub** (`ws:fanout`), so a client on any replica gets events triggered on any other.
- A Redis outage degrades gracefully to per-instance behaviour (don't run >1 replica without Redis).

## Uptime
- **Health**: `GET /health` (DB + Redis + uptime; 503 if DB down). Wired into the backend container healthcheck + LB.
- **Graceful shutdown**: SIGTERM drains in-flight requests + closes Redis before exit → safe rolling deploys.
- **Restart**: `restart: always` + `restart_policy` (≤5 attempts on failure).
- **Crash resilience**: unhandled promise rejections are logged, not fatal.

## Recommended external (not in this repo)
- **Managed Postgres** with automated backups + **read replica**; point analytics/report traffic at the replica.
- **CDN** (Cloudflare) in front of MinIO/object storage — uploads are WebP + `Cache-Control: immutable`, so the CDN serves them and they never hit the app.
- **TLS** termination at nginx or an upstream LB; set `ALLOWED_ORIGINS` to the https domain.
- **Monitoring**: uptime ping on `/health` (UptimeRobot/Better Stack), error tracking (Sentry), Postgres slow-query log.
- **Backups**: nightly `pg_dump` (or managed snapshots) + test restores; Redis is a cache (AOF helps but treat as rebuildable).

## Notes
- `sharp` (image compression) ships native binaries — built inside the Linux container via `bun install`, so no host dependency.
- Bell notifications (`broadcastToRole`) are DB-backed and eventually consistent across replicas; the live-refresh events and direct user pushes fan out in real time.
