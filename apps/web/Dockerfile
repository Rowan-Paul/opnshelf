# syntax=docker/dockerfile:1
# Frontend (TanStack Start + Nitro node-server) for the opnshelf pnpm monorepo.
# Build context is the REPO ROOT — on Railway set RAILWAY_DOCKERFILE_PATH=apps/web/Dockerfile.

FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate
WORKDIR /app

# ---- deps: install only the web app's workspace closure ----
FROM base AS deps
# Copy every workspace manifest so --frozen-lockfile matches the committed lockfile,
# then --filter restricts the real install to web + its deps. This skips the heavy
# native deps in backend (prisma/canvas) and mobile (expo/react-native) entirely.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/mobile/package.json ./apps/mobile/
COPY packages/api/package.json ./packages/api/
COPY backend/package.json ./backend/
RUN pnpm install --frozen-lockfile --filter "@opnshelf/web..."

# ---- build: bake VITE_* public vars and emit .output ----
FROM deps AS build
# Vite inlines VITE_* at build time, so these must be present as env during `vite build`.
# Railway passes service variables to Docker builds as build args; we re-export them as ENV.
ARG VITE_API_URL
ARG VITE_SITE_URL
ARG VITE_PDS_HANDLE_DOMAIN
ARG VITE_TURNSTILE_SITE_KEY
ARG VITE_POSTHOG_KEY
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SITE_URL=$VITE_SITE_URL \
    VITE_PDS_HANDLE_DOMAIN=$VITE_PDS_HANDLE_DOMAIN \
    VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY \
    VITE_POSTHOG_KEY=$VITE_POSTHOG_KEY
COPY packages/api ./packages/api
COPY apps/web ./apps/web
RUN pnpm --filter @opnshelf/web build

# ---- runtime: self-contained Nitro node-server ----
# The node-server preset traces its own node_modules into .output, so the runtime
# image needs nothing but Node and the build output.
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
