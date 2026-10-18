# syntax=docker/dockerfile:1
# Build context: repository root. This service is outside the pnpm workspace.
FROM node:24-trixie-slim AS dependencies
WORKDIR /app
# sqlite3 falls back to a native build when a matching prebuild is unavailable.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
COPY services/lighthouse/package.json services/lighthouse/package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-trixie-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=9001 LHCI_STORAGE_PATH=/data/lhci.db
COPY --from=dependencies /app/node_modules ./node_modules
COPY services/lighthouse/package.json services/lighthouse/index.mjs ./
EXPOSE 9001
CMD ["node", "index.mjs"]
