// Run with an explicitly supplied DATABASE_URL; never loads backend/.env.
// node scripts/backfill-catalogue-colors.cjs
async function backfillCatalogueColors(prisma, extraction, nullFilter) {
  const totals = { updated: 0, failed: 0 };
  for (const [model, id] of [['movie', 'movieId'], ['show', 'showId']]) {
    let after;
    for (;;) {
      const rows = await prisma[model].findMany({
        where: { colors: nullFilter, posterPath: { not: null }, ...(after ? { [id]: { gt: after } } : {}) },
        select: { [id]: true, posterPath: true },
        orderBy: { [id]: 'asc' },
        take: 100,
      });
      if (!rows.length) break;
      for (const row of rows) {
        const colors = await extraction.extractColorsFromPoster(row.posterPath);
        if (colors) {
          // Do not overwrite a palette or changed poster hydrated during extraction.
          const result = await prisma[model].updateMany({
            where: { [id]: row[id], colors: nullFilter, posterPath: row.posterPath },
            data: { colors },
          });
          totals.updated += result.count;
        } else {
          totals.failed++;
        }
      }
      after = rows.at(-1)[id];
    }
  }
  return totals;
}

module.exports = { backfillCatalogueColors };

if (require.main === module) {
  if (!process.env.DATABASE_URL) throw new Error('Supply DATABASE_URL explicitly for the catalogue backfill');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  require(`${root}/backend/node_modules/ts-node`).register({ project: `${root}/backend/tsconfig.json`, experimentalResolver: true });
  const { PrismaService } = require(`${root}/backend/src/prisma/prisma.service.ts`);
  const { Prisma } = require(`${root}/backend/src/generated/client.ts`);
  const { ColorExtractionService } = require(`${root}/backend/src/movies/color-extraction.service.ts`);
  const prisma = new PrismaService();
  backfillCatalogueColors(prisma, new ColorExtractionService(), { equals: Prisma.AnyNull })
    .then(result => {
      console.log(JSON.stringify(result));
      if (result.failed) process.exitCode = 1;
    })
    .catch(() => { console.error('Catalogue color backfill failed'); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
