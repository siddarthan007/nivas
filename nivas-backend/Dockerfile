# ============================================================
# Nivas PMS Backend — Production Dockerfile (multi-stage)
# oven/bun:1 base → lean release image with non-root user
# ============================================================

# ── Stage 1: base ────────────────────────────────────────────
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# ── Stage 2: install deps ─────────────────────────────────────
FROM base AS install

# Production deps only
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# ── Stage 3: release ──────────────────────────────────────────
FROM base AS release

# PostgreSQL 16 client (pg_dump / pg_restore) for DB backups + restore.
# PGDG repo so the major version matches the postgres:16 server.
USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo $VERSION_CODENAME)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-16 \
  && apt-get purge -y gnupg && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

# Copy production node_modules
COPY --from=install /temp/prod/node_modules ./node_modules

# Copy source
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY public/ ./public/
COPY drizzle.config.ts ./drizzle.config.ts
COPY package.json ./package.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh

# Create uploads directory (will be overridden by volume in compose)
RUN mkdir -p public/uploads

# Use non-root user (built into oven/bun image)
RUN chown -R bun:bun /usr/src/app
USER bun

# Make entrypoint executable
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["bun", "run", "src/index.ts"]
