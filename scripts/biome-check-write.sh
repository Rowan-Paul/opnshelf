#!/usr/bin/env sh
set -eu

pnpm exec sh -lc 'cd apps/mobile && biome check . --write --unsafe'
pnpm exec sh -lc 'cd apps/web && biome check --write --unsafe'
pnpm exec sh -lc 'cd backend && biome check --write --unsafe'
