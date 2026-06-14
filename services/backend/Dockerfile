# ============================================================
# Nivas PMS Backend — Production Dockerfile (multi-stage)
# oven/bun:1 base → lean release image
# ============================================================

FROM oven/bun:1 AS base
WORKDIR /usr/src/app

FROM base AS install

COPY package.json bun.lock ./
COPY packages/ ./packages/
COPY apps/web/package.json ./apps/web/
COPY apps/mobile/package.json ./apps/mobile/
COPY services/backend/package.json ./services/backend/
COPY services/backend/scripts/verify-typebox.mjs ./services/backend/scripts/verify-typebox.mjs

RUN bun install --frozen-lockfile --production --filter nivas-backend --filter @nivas/shared-utils \
  && cd services/backend && bun scripts/verify-typebox.mjs

FROM base AS release

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo $VERSION_CODENAME)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-16 \
  && apt-get purge -y gnupg && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

COPY --from=install /usr/src/app/node_modules ./node_modules
COPY --from=install /usr/src/app/packages ./packages

WORKDIR /usr/src/app/services/backend

COPY services/backend/drizzle.config.ts ./
COPY services/backend/docker-entrypoint.sh ./
COPY services/backend/src ./src
COPY services/backend/public ./public
COPY services/backend/scripts ./scripts
COPY services/backend/package.json ./package.json

RUN mkdir -p public/uploads && chmod +x docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["bun", "src/index.ts"]
