# ============================================================
# Nivas PMS Frontend — Production Dockerfile (multi-stage)
# Stage 1: Bun builds React app → dist/
# Stage 2: nginx:alpine serves static files + proxies /api/*
# ============================================================

# ── Stage 1: build ───────────────────────────────────────────
FROM oven/bun:1 AS build
WORKDIR /usr/src/app

# Install deps (cached layer)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source and build
COPY . .
ENV NODE_ENV=production
RUN bun run build

# ── Stage 2: nginx release ────────────────────────────────────
FROM nginx:1.27-alpine AS release

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/nivas.conf

# Copy built SPA
COPY --from=build /usr/src/app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:80/ > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
