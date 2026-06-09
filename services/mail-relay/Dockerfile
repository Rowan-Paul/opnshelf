# syntax=docker/dockerfile:1
# Standalone SMTP→Cloudflare relay.
# Build context is the REPO ROOT (Railway uploads the whole git repo), so COPY
# paths are prefixed with services/mail-relay/. On Railway set the service var
# RAILWAY_DOCKERFILE_PATH=services/mail-relay/Dockerfile so this is used instead
# of Railpack. The service is NOT part of the pnpm workspace.

FROM node:24-slim AS deps
WORKDIR /app
COPY services/mail-relay/package.json services/mail-relay/package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY services/mail-relay/package.json services/mail-relay/index.js ./
# Internal private-network listener; no public port needed.
EXPOSE 2500
CMD ["node", "index.js"]
