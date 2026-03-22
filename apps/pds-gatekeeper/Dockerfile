FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/pds-gatekeeper/package.json apps/pds-gatekeeper/package.json

RUN pnpm install --frozen-lockfile --filter @opnshelf/pds-gatekeeper...

COPY apps/pds-gatekeeper apps/pds-gatekeeper

RUN pnpm --filter @opnshelf/pds-gatekeeper build

WORKDIR /app/apps/pds-gatekeeper

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["pnpm", "start"]
