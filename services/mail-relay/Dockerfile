# syntax=docker/dockerfile:1
# Standalone SMTP→Cloudflare relay. NOT part of the pnpm workspace — the build
# context is THIS directory. On Railway set the service Root Directory to
# services/mail-relay (Dockerfile auto-detected), or RAILWAY_DOCKERFILE_PATH.

FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json index.js ./
# Internal private-network listener; no public port needed.
EXPOSE 2500
CMD ["node", "index.js"]
