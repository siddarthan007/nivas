# Nivas PMS — Setup Guide

Two ways to run: **Docker (recommended)** or manual local setup.

## Monorepo layout

| Path | Role |
|------|------|
| `apps/web` | Staff/admin React SPA |
| `apps/mobile` | Expo staff mobile app |
| `services/backend` | Elysia API server |
| `packages/*` | Shared types, API client, theme, utils |

---

## Docker Setup (Recommended)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose v2)

### 1. Clone the repo

```bash
git clone <repository-url> nivas-pms
cd nivas-pms
```

### 2. Configure environment

```bash
# Backend
cp services/backend/.env.example services/backend/.env

# Web
cp apps/web/.env.example apps/web/.env

# Mobile (optional)
cp apps/mobile/.env.example apps/mobile/.env
```

Edit `services/backend/.env` — at minimum set:
```env
POSTGRES_PASSWORD=your-db-password
JWT_SECRET=your-random-32-char-secret
```

> **Note:** `DATABASE_URL` in `.env` is overridden by docker-compose to use the `postgres` service name. No manual changes needed for Docker.

### 3. Start (development — hot reload)

```bash
docker compose up --build
```

| Service  | URL                        |
|----------|---------------------------|
| Web      | http://localhost:5173      |
| Backend  | http://localhost:3000      |
| API Docs | http://localhost:3000/docs |
| DB       | localhost:5432             |

On first boot the backend container automatically:
1. Waits for PostgreSQL to be ready
2. Syncs the database schema (`drizzle-kit push` via `docker-entrypoint.sh`)
3. Seeds the super admin account

On every API start, supplemental boot SQL in `src/db/migrations.ts` also runs (extensions, constraints, idempotent column adds).

> **Docker vs versioned migrations:** Docker uses `db:push` (schema.ts → DB). The `drizzle/` SQL folder is for `DB_MIGRATION_MODE=migrate` or manual `bun run db:migrate` outside Docker — not used by default compose startup.

**Default admin credentials:**
- Email: `admin@nivaspms.com`
- Password: `Admin@123`

> Change the password after first login.

### 4. Start (production)

```bash
# Set required secrets
export POSTGRES_PASSWORD=strong-db-password
export JWT_SECRET=$(openssl rand -hex 32)

docker compose -f docker-compose.prod.yml up --build -d
```

Production backend uses the same entrypoint: `drizzle-kit push` on start, then boot SQL in `src/db/migrations.ts` when the API boots. Set `DB_MIGRATION_MODE=migrate` on the backend service only if you maintain versioned SQL in `services/backend/drizzle/`.

Production serves everything on **port 80** via nginx. No separate web port.

### 5. Common commands

```bash
# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Stop
docker compose down

# Stop + remove volumes (wipes DB!)
docker compose down -v

# Re-run schema sync manually (same as container entrypoint)
docker compose exec backend bun run db:push

# Optional: apply versioned SQL migrations instead
# docker compose exec -e DB_MIGRATION_MODE=migrate backend bun run db:migrate

# Re-seed super admin
docker compose exec backend bun run db:seed

# Audit API route permissions
docker compose exec backend bun run audit:permissions

# Open DB shell
docker compose exec postgres psql -U postgres -d nivas_db
```

---

## Manual Local Setup

### Prerequisites
1. **Bun** — [bun.sh](https://bun.sh/) (`powershell -c "irm bun.sh/install.ps1 | iex"` on Windows)
2. **PostgreSQL** v14+ — [postgresql.org](https://www.postgresql.org/download/)
3. **Git**

### Backend

```bash
cd services/backend
bun install
cp .env.example .env
# Edit .env — set DATABASE_URL to local postgres
bun run db:push          # sync schema (same as Docker entrypoint)
bun run db:seed          # seed super admin
bun run dev              # start with hot reload → localhost:3000
```

### Web

```bash
cd apps/web
bun install
cp .env.example .env
# Edit .env — set BACKEND_URL=http://localhost:3000
bun run dev              # start → localhost:5173
```

### Mobile (optional)

```bash
cd apps/mobile
bun install
cp .env.example .env
# Set EXPO_PUBLIC_API_URL to your LAN IP, e.g. http://192.168.1.10:3000
bun run start
```

---

## Troubleshooting

- **DB connection error in Docker:** Check `POSTGRES_PASSWORD` matches in `.env` and docker-compose env.
- **Port conflict:** Change host ports in `docker-compose.yml` (e.g. `"3001:3000"`).
- **Migration fails:** Run `docker compose logs backend` for details.
- **CORS errors (local):** Ensure `ALLOWED_ORIGINS` in `services/backend/.env` includes `http://localhost:5173`.

---

**Enjoy building with Nivas PMS!**
