const { test } = require('node:test');
const assert = require('node:assert/strict');
const { backfillCatalogueColors } = require('./backfill-catalogue-colors.cjs');

test('backfills both catalogues, advances past failed posters, and preserves concurrent hydration', async () => {
  const nullFilter = { equals: 'AnyNull' };
  const extracted = [];
  const updates = [];
  const prisma = {};
  for (const [model, id] of [['movie', 'movieId'], ['show', 'showId']]) {
    let page = 0;
    prisma[model] = {
      async findMany(args) {
        assert.equal(args.where.colors, nullFilter);
        assert.deepEqual(args.where.posterPath, { not: null });
        assert.equal(args.take, 100);
        if (page++ === 0) return [{ [id]: '1', posterPath: '/ok.jpg' }, { [id]: '2', posterPath: '/failed.jpg' }];
        assert.deepEqual(args.where[id], { gt: '2' });
        return [];
      },
      async updateMany(args) {
        assert.deepEqual(args.where, { [id]: '1', colors: nullFilter, posterPath: '/ok.jpg' });
        assert.deepEqual(args.data.colors, { primary: '#123456' });
        updates.push(model);
        return { count: model === 'movie' ? 1 : 0 };
      },
    };
  }
  const result = await backfillCatalogueColors(prisma, {
    async extractColorsFromPoster(poster) {
      extracted.push(poster);
      return poster === '/ok.jpg' ? { primary: '#123456' } : null;
    },
  }, nullFilter);
  assert.deepEqual(updates, ['movie', 'show']);
  assert.equal(extracted.length, 4);
  assert.deepEqual(result, { updated: 1, failed: 2 });
});
