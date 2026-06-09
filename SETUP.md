# Nivas PMS — Setup Guide

Two ways to run: **Docker (recommended)** or manual local setup.

---

## 🐳 Docker Setup (Recommended)

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
cp nivas-backend/.env.example nivas-backend/.env

# Frontend
cp nivas-frontend/.env.example nivas-frontend/.env
```

Edit `nivas-backend/.env` — at minimum set:
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
| Frontend | http://localhost:5173      |
| Backend  | http://localhost:3000      |
| API Docs | http://localhost:3000/swagger |
| DB       | localhost:5432             |

On first boot the backend container automatically:
1. Waits for PostgreSQL to be ready
2. Runs DB migrations (`drizzle-kit push`)
3. Seeds the super admin account

**Default admin credentials:**
- Email: `admin@nivaspms.com`
- Password: `Admin@123`

> ⚠️ Change the password after first login.

### 4. Start (production)

```bash
# Set required secrets
export POSTGRES_PASSWORD=strong-db-password
export JWT_SECRET=$(openssl rand -hex 32)

docker compose -f docker-compose.prod.yml up --build -d
```

Production serves everything on **port 80** via nginx. No separate frontend port.

### 5. Common commands

```bash
# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Stop
docker compose down

# Stop + remove volumes (wipes DB!)
docker compose down -v

# Re-run migrations manually
docker compose exec backend bun run db:migrate

# Re-seed super admin
docker compose exec backend bun run db:seed

# Open DB shell
docker compose exec postgres psql -U postgres -d nivas_db
```

---

## 🛠 Manual Local Setup

### Prerequisites
1. **Bun** — [bun.sh](https://bun.sh/) (`powershell -c "irm bun.sh/install.ps1 | iex"` on Windows)
2. **PostgreSQL** v14+ — [postgresql.org](https://www.postgresql.org/download/)
3. **Git**

### Backend

```bash
cd nivas-backend
bun install
cp .env.example .env
# Edit .env — set DATABASE_URL to local postgres
bun run db:push          # run migrations
bun run db:seed          # seed super admin
bun run dev              # start with hot reload → localhost:3000
```

### Frontend

```bash
cd nivas-frontend
bun install
cp .env.example .env
# Edit .env — set BACKEND_URL=http://localhost:3000
bun run dev              # start → localhost:5173
```

---

## 4. Troubleshooting

- **DB connection error in Docker:** Check `POSTGRES_PASSWORD` matches in `.env` and docker-compose env.
- **Port conflict:** Change host ports in `docker-compose.yml` (e.g. `"3001:3000"`).
- **Migration fails:** Run `docker compose logs backend` for details.
- **CORS errors (local):** Ensure `ALLOWED_ORIGINS` in `nivas-backend/.env` includes `http://localhost:5173`.

---

**Enjoy building with Nivas PMS!**
