FROM node:22-bookworm-slim AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/pds-gatekeeper/package.json apps/pds-gatekeeper/package.json

RUN pnpm install --frozen-lockfile --filter @opnshelf/pds-gatekeeper...

COPY apps/pds-gatekeeper apps/pds-gatekeeper

RUN pnpm --filter @opnshelf/pds-gatekeeper build

# Verify the expected entry point exists so the build fails fast if the
# output path ever drifts again.
RUN test -f /app/apps/pds-gatekeeper/dist/server.js

# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS runner

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/pds-gatekeeper/package.json apps/pds-gatekeeper/package.json

RUN pnpm install --frozen-lockfile --filter @opnshelf/pds-gatekeeper... --prod

# Copy the compiled output from the builder stage.
COPY --from=builder /app/apps/pds-gatekeeper/dist /app/apps/pds-gatekeeper/dist

WORKDIR /app/apps/pds-gatekeeper

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/server.js"]
