import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/client";
import { deleteFixtureOwner } from "./db-fixtures";

/** Vitest globalSetup: before database suites run, seed rows that belong to no
 * suite, so an assertion that reads a whole table fails here, as it would once
 * another suite writes in parallel. Teardown then fails the run if any suite
 * changed or deleted those rows: a cleanup or update that was not scoped to
 * its own FixtureOwner. A few inserts; no slower run.
 *
 * Excluded on purpose: FeaturedContent is one global selection with a cap of
 * five, so its suite owns that table outright (see featured.integration.spec). */
const databaseUrls = [
	"TRAKT_SYNC_TEST_DATABASE_URL",
	"WATCH_PRIVACY_TEST_DATABASE_URL",
	"SOCIAL_TEST_DATABASE_URL",
	"FEATURED_TEST_DATABASE_URL",
];
const FOREIGN = "did:plc:foreign-fixture";
const foreignDids = [`${FOREIGN}-a`, `${FOREIGN}-b`];
// Never due, so a suite's own Sync tick never processes a foreign connection.
const notDue = new Date("2999-01-01T00:00:00Z");

function urls() {
	const found = new Set(
		databaseUrls.flatMap((name) => process.env[name] ?? []),
	);
	for (const url of found)
		if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
			throw new Error("Database isolation seeding requires a local database");
	return [...found];
}

async function withDb(url: string, run: (db: PrismaClient) => Promise<void>) {
	const db = new PrismaClient({
		adapter: new PrismaPg({ connectionString: url, max: 2 }),
	});
	try {
		await run(db);
	} finally {
		await db.$disconnect();
	}
}

async function removeForeign(db: PrismaClient) {
	for (const did of foreignDids) await deleteFixtureOwner(db, did);
	await db.authState.deleteMany({
		where: { key: { startsWith: `trakt:${FOREIGN}` } },
	});
	await db.movie.deleteMany({ where: { movieId: { startsWith: FOREIGN } } });
}

async function seedForeign(db: PrismaClient) {
	await removeForeign(db);
	const movieId = `${FOREIGN}-movie`;
	await db.movie.create({ data: { movieId, title: "Foreign movie" } });
	for (const did of foreignDids) {
		await db.user.create({
			data: {
				did,
				handle: `${did.slice("did:plc:".length)}.test`,
				trackedMovies: {
					create: { rkey: "foreign", uri: `at://${did}/m`, cid: "c", movieId },
				},
				privacyScopes: {
					create: {
						key: "foreign",
						category: "lists",
						copies: {
							create: {
								migrationId: "foreign",
								collection: "xyz.opnshelf.list",
								rkey: "foreign",
								cid: "c",
								value: {},
							},
						},
					},
				},
				integrationConnections: {
					create: ["trakt", "popfeed"].map((provider) => ({
						provider,
						accountId: `${did}-${provider}`,
						username: "foreign",
						status: "active",
						nextRunAt: notDue,
						entries: {
							create: [
								{ kind: "watch", linked: true, localKey: "movie:foreign" },
								{ kind: "list", eligible: true, remoteKey: "list:foreign" },
								{
									kind: "watch",
									issue: "Both services changed this item.",
								},
								{
									kind: "watch",
									issue: "Trakt cannot represent another Watch.",
								},
							],
						},
					})),
				},
			},
		});
		const job = await db.backgroundJob.create({
			data: { type: "watch_privacy", userDid: did, status: "completed" },
		});
		await db.watchPrivacyCopy.create({
			data: {
				jobId: job.id,
				collection: "xyz.opnshelf.movie",
				rkey: "foreign",
				cid: "c",
				value: {},
			},
		});
		await db.watchPrivacyMigration.create({
			data: {
				jobId: job.id,
				userDid: did,
				sourceVisibility: "public",
				targetVisibility: "private",
			},
		});
		await db.authState.create({
			data: {
				// Shaped like a real Trakt Sync state, which suites must leave alone.
				key: `trakt:${did}`,
				stateData: "foreign",
				expiresAt: notDue,
			},
		});
	}
	await db.follow.create({
		data: { followerDid: foreignDids[0], followingDid: foreignDids[1] },
	});
}

/** Everything seeded, so teardown can tell whether a suite touched it. */
async function snapshot(db: PrismaClient) {
	const users = await db.user.findMany({
		where: { did: { in: foreignDids } },
		orderBy: { did: "asc" },
		include: {
			trackedMovies: true,
			privacyScopes: { include: { copies: true } },
			integrationConnections: {
				orderBy: { provider: "asc" },
				include: { entries: { orderBy: { id: "asc" } } },
			},
			following: true,
			watchPrivacyMigration: {
				include: { job: { include: { watchPrivacyCopies: true } } },
			},
		},
	});
	const states = await db.authState.findMany({
		where: { key: { startsWith: `trakt:${FOREIGN}` } },
		orderBy: { key: "asc" },
	});
	return JSON.stringify({ users, states });
}

export async function setup() {
	const seeded = new Map<string, string>();
	for (const url of urls())
		await withDb(url, async (db) => {
			await seedForeign(db);
			seeded.set(url, await snapshot(db));
		});
	return async () => {
		for (const [url, before] of seeded)
			await withDb(url, async (db) => {
				const after = await snapshot(db);
				await removeForeign(db);
				if (after !== before)
					throw new Error(
						"A database suite changed or deleted rows it does not own. Scope cleanups and updates to the suite's FixtureOwner (test/db-fixtures.ts).",
					);
			});
	};
}
