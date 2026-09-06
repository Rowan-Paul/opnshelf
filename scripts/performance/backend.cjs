// Local-only benchmark: the real ShelfService and its SQL, synthetic PostgreSQL data.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
require(`${root}/backend/node_modules/ts-node`).register({project: `${root}/backend/tsconfig.json`, transpileOnly: true, experimentalResolver: true});
const { Pool } = require(require.resolve('pg', {paths:[path.dirname(require.resolve(`${root}/backend/node_modules/@prisma/adapter-pg`))]}));
const { execFileSync } = require('node:child_process');
const Module = require('node:module');
function source(relative, ref = process.env.PERF_REF) {
 if(!ref) return require(`${root}/${relative}`);
 const filename=`${root}/${relative}`;
 const code=execFileSync('git',['show',`${ref}:${relative}`],{cwd:root,encoding:'utf8'});
 const m=new Module(filename,module); m.filename=filename; m.paths=Module._nodeModulePaths(path.dirname(filename));
 const ts=require(`${root}/backend/node_modules/typescript`);
 m._compile(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true}}).outputText,filename);
 return m.exports;
}
const { ShelfService } = source('backend/src/shelf/shelf.service.ts');
const { ShowProgressService } = source('backend/src/shows/show-progress.service.ts');
const { ShowCatalogueService } = require(`${root}/backend/src/shows/show-catalogue.service.ts`);
const pool = new Pool({host:'127.0.0.1', port:55439, user:'postgres', database:'postgres', max:10});
let calls = 0;
const query = async (text, values=[]) => { calls++; return (await pool.query(text, values)).rows; };
const prisma = {
  trackedMovie: {count: async () => Number((await query('SELECT count(*) FROM "TrackedMovie" WHERE "userDid"=$1', ['benchmark']))[0].count)},
  trackedEpisode: {findMany: async () => query('SELECT DISTINCT "showId" FROM "TrackedEpisode" WHERE "userDid"=$1',["benchmark"]), count: async () => Number((await query('SELECT count(*) FROM "TrackedEpisode" WHERE "userDid"=$1', ['benchmark']))[0].count)},
  episode: {findMany: async () => query(`SELECT e.*, timestamp '2026-09-01' AS "airDate", json_build_object('show', row_to_json(s)) AS season FROM "Episode" e JOIN "Show" s USING ("showId") ORDER BY e."showId", e."episodeNumber" LIMIT 200`)},
  list: {findFirst: async () => {await query('SELECT 1'); return {items:[]};}},
  $queryRaw: async sql => query(sql.text, sql.values),
  movie: {findUnique: async ({where}) => (await query('SELECT "posterPath", colors FROM "Movie" WHERE "movieId"=$1',[where.movieId]))[0]},
  show: {findUnique: async ({where}) => (await query('SELECT "posterPath", colors FROM "Show" WHERE "showId"=$1',[where.showId]))[0]},
};
async function main() {
 if(process.argv.includes('--verify')) {
   const assert=require('node:assert/strict');
   const Original=source('backend/src/shelf/shelf.service.ts','HEAD').ShelfService;
   const Current=source('backend/src/shelf/shelf.service.ts','').ShelfService;
   const original=new Original(prisma,{}),current=new Current(prisma);
   let cases=0;
   for(const type of [undefined,'movie','episode']) for(const sort of ['asc','desc']) for(const page of [1,2,200,99999]) {
     const args=['benchmark',page,20,type,undefined,sort];
     assert.deepEqual(await current.getUserShelf(...args),await original.getUserShelf(...args)); cases++;
   }
   console.log(`Matched original Shelf results for ${cases} cases (mixed/movie/episode, ascending/descending, pagination and undated Watches).`);
   return;
 }

 if (process.argv.includes('--seed')) {
 await pool.query(`
 DROP TABLE IF EXISTS "TrackedMovie", "TrackedEpisode", "Episode", "Movie", "Show";
 CREATE TABLE "Movie" ("movieId" text PRIMARY KEY, title text, "posterPath" text, "backdropPath" text, "releaseYear" int, "releaseDate" timestamp, overview text, colors jsonb);
 CREATE TABLE "Show" ("showId" text PRIMARY KEY, title text, "posterPath" text, "backdropPath" text, "firstAirYear" int, "firstAirDate" timestamp, overview text, colors jsonb);
 CREATE TABLE "Episode" ("showId" text, "seasonNumber" int, "episodeNumber" int, name text, "stillPath" text, overview text, PRIMARY KEY ("showId", "seasonNumber", "episodeNumber"));
 CREATE TABLE "TrackedMovie" (id text PRIMARY KEY, "userDid" text, "movieId" text, "watchedDate" timestamp, "createdAt" timestamp);
 CREATE TABLE "TrackedEpisode" (id text PRIMARY KEY, "userDid" text, "showId" text, "seasonNumber" int, "episodeNumber" int, "watchedDate" timestamp, "createdAt" timestamp);
 CREATE INDEX ON "TrackedMovie" ("userDid"); CREATE INDEX ON "TrackedMovie" ("movieId"); CREATE INDEX ON "TrackedMovie" ("watchedDate"); CREATE INDEX ON "TrackedMovie" ("createdAt");
 CREATE INDEX ON "TrackedEpisode" ("userDid"); CREATE INDEX ON "TrackedEpisode" ("showId"); CREATE INDEX ON "TrackedEpisode" ("seasonNumber"); CREATE INDEX ON "TrackedEpisode" ("episodeNumber"); CREATE INDEX ON "TrackedEpisode" ("watchedDate"); CREATE INDEX ON "TrackedEpisode" ("createdAt");
 INSERT INTO "Movie" SELECT i::text, 'Movie '||i, null,null,2020,'2020-01-01','Synthetic overview', '{"primary":"#123456"}' FROM generate_series(1,2000) i;
 INSERT INTO "Show" SELECT i::text, 'Show '||i, null,null,2020,'2020-01-01','Synthetic overview','{"primary":"#123456"}' FROM generate_series(1,200) i;
 INSERT INTO "Episode" SELECT s::text, 1,e,'Episode '||e,null,'Synthetic overview' FROM generate_series(1,200) s CROSS JOIN generate_series(1,100) e;
 INSERT INTO "TrackedMovie" SELECT i::text,'benchmark',((i-1)%2000+1)::text, CASE WHEN i%10=0 THEN null ELSE timestamp '2026-09-01' - i*interval '1 minute' END, timestamp '2026-09-01' - i*interval '1 minute' FROM generate_series(1,10000) i;
 INSERT INTO "TrackedEpisode" SELECT i::text,'benchmark',((i-1)%200+1)::text,1,((i-1)/200%100+1),CASE WHEN i%10=0 THEN null ELSE timestamp '2026-09-01' - i*interval '1 minute' END,timestamp '2026-09-01' - i*interval '1 minute' FROM generate_series(1,100000) i;
 ANALYZE;
 `);
 }
 const service = new ShelfService(prisma, {extractColorsFromPoster: () => {throw new Error('Unexpected extraction on warm benchmark');}});
 const results = [];
 for (const pageSize of [20,50]) {
   const samples=[]; let result;
   for(let i=0;i<35;i++) {
     calls=0; const start=performance.now(); result=await service.getUserShelf('benchmark',1,pageSize);
     if(i>=5) samples.push(performance.now()-start);
   }
   samples.sort((a,b)=>a-b);
   results.push({pageSize, medianMs:samples[15], p95Ms:samples[28], databaseCalls:calls,total:result.total, ids:result.items.map(i=>i.id), watchCounts:result.items.map(i=>i.data.watchCount)});
 }
 const progress=new ShowProgressService(prisma,new ShowCatalogueService(prisma,{},{}));
 const calendarSamples=[]; let calendar;
 for(let i=0;i<35;i++) {
   calls=0;const start=performance.now();calendar=await progress.getUserReleaseCalendar('benchmark',{startDate:'2026-09-01',endDate:'2026-09-30'});
   if(i>=5)calendarSamples.push(performance.now()-start);
 }
 calendarSamples.sort((a,b)=>a-b);
 results.push({calendarEpisodes:calendar.items.length,medianMs:calendarSamples[15],p95Ms:calendarSamples[28],databaseCalls:calls});
 const output={runtime:process.version, fixture:{movieWatches:10000,episodeWatches:100000},warmups:5,samples:30,results};
 console.log(JSON.stringify(output,null,2));
 if(process.env.PERF_OUTPUT) fs.writeFileSync(process.env.PERF_OUTPUT,JSON.stringify(output,null,2)+'\n');
}
main().finally(()=>pool.end()).catch(e=>{console.error(e);process.exitCode=1;});
