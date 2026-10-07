import { createHash } from "node:crypto";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../generated/client";
import type { PrismaService } from "../prisma/prisma.service";
import type { MoviesService } from "../movies/movies.service";
import type { ShowsService } from "../shows/shows.service";
import { WATCH_SPACE_SCOPE } from "../auth/oauth-scopes";
import { WatchAccountLock } from "./watch-account-lock";
import { WatchPrivacyCoordinator } from "./watch-privacy-coordinator";
import { WatchPrivacyService } from "./watch-privacy.service";
import { publicWatchOwner, publicWatchOwnerSql } from "./watch-access";
const url = process.env.WATCH_PRIVACY_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
	throw new Error("Use disposable local PostgreSQL");

/** Deterministic PDS double exercises recovery with real migrations, locks,
 * journal commits, and projections. Actual PDS/OAuth is a separate smoke test. */
function pdsFixture(did: string) {
	const publicRecords = new Map<
		string,
		{ cid: string; value: Record<string, unknown> }
	>();
	const privateRecords = new Map<
		string,
		{ cid: string; value: Record<string, unknown> }
	>();
	let hasSpace = false;
	let supportsDelete = true;
	let failDelete = false;
	const policy = { $type: "com.atproto.simplespace.defs#memberListPolicy" };
	const cid = (value: unknown) =>
		createHash("sha256").update(JSON.stringify(value)).digest("hex");
	const session = {
		did,
		getTokenInfo: async () => ({ scope: WATCH_SPACE_SCOPE }),
		fetchHandler: async (path: string, init?: RequestInit) => {
			const endpoint = new URL(path, "http://local.test");
			const params = init?.body
				? JSON.parse(String(init.body))
				: Object.fromEntries(endpoint.searchParams);
			const method = endpoint.pathname.split(".").at(-1);
			const space = `at://${did}/space/xyz.opnshelf.watches/self`;
			const isPrivate = endpoint.pathname.includes(".space.");
			const records = isPrivate ? privateRecords : publicRecords;
			const key = `${params.collection}/${params.rkey}`;
			const uri = (key: string) =>
				isPrivate ? `${space}/${did}/${key}` : `at://${did}/${key}`;
			const respond = (body: unknown, status = 200) =>
				new Response(JSON.stringify(body), { status });
			if (method === "describeServer")
				return respond({
					tranquilSpaceCapabilities: supportsDelete
						? ["deleteRecord.swapRecord.v1"]
						: [],
				});
			if (method === "createSpace") {
				hasSpace = true;
				return respond({});
			}
			if (method === "getSpace")
				return hasSpace
					? respond({ readPolicy: policy, writePolicy: policy })
					: respond({ error: "SpaceNotFound" }, 400);
			if (method === "listMembers") return respond({ members: [] });
			if (method === "listRecords")
				return respond({
					records: [...records]
						.filter(([key]) => key.startsWith(`${params.collection}/`))
						.slice(0, Number(params.limit))
						.map(([key, record]) => ({
							...(isPrivate
								? { collection: key.split("/")[0], rkey: key.split("/")[1] }
								: { uri: uri(key) }),
							...record,
						})),
				});
			if (method === "getRecord")
				return records.has(key)
					? respond({ uri: uri(key), ...records.get(key) })
					: respond({ error: "RecordNotFound" }, 400);
			if (method === "createRecord") {
				if (records.has(key))
					return respond({ error: "RecordAlreadyExists" }, 400);
				records.set(key, { cid: cid(params.record), value: params.record });
				return respond({ uri: uri(key), cid: records.get(key)?.cid });
			}
			if (method === "deleteRecord") {
				if (failDelete) {
					failDelete = false;
					return respond({ error: "InternalError" }, 500);
				}
				if (!isPrivate && records.get(key)?.cid !== params.swapRecord)
					return respond({ error: "InvalidSwap" }, 400);
				records.delete(key);
				return respond({});
			}
			throw new Error(`Unexpected test method ${method}`);
		},
	};
	return {
		session,
		publicRecords,
		privateRecords,
		seed(collection: string, rkey: string, value: Record<string, unknown>) {
			publicRecords.set(`${collection}/${rkey}`, { cid: cid(value), value });
		},
		failNextDelete() {
			failDelete = true;
		},
		disableConditionalDelete() {
			supportsDelete = false;
		},
	};
}

describe.skipIf(!url)("Watch privacy runtime on PostgreSQL", () => {
	let db: PrismaClient;
	let pool: Pool;
	let coordinator: WatchPrivacyCoordinator;
	let privacy: WatchPrivacyService;
	let pds: ReturnType<typeof pdsFixture>;
	let did: string;
	async function run() {
		const migration = await db.watchPrivacyMigration.findUniqueOrThrow({
			where: { userDid: did },
		});
		await privacy.runMigration(migration);
	}
	beforeAll(() => {
		db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
		pool = new Pool({
			connectionString: url,
			max: 2,
			query_timeout: 5000,
			connectionTimeoutMillis: 1000,
		});
		coordinator = new WatchPrivacyCoordinator(
			db as PrismaService,
			new WatchAccountLock(pool),
		);
	});
	beforeEach(async () => {
		did = `did:plc:runtime-${crypto.randomUUID()}`;
		pds = pdsFixture(did);
		await db.user.create({
			data: {
				did,
				handle: `${crypto.randomUUID()}.test`,
				watchPrivacyEnabled: true,
			},
		});
		await db.movie.upsert({
			where: { movieId: "runtime-1" },
			create: { movieId: "runtime-1", title: "Migration test" },
			update: {},
		});
		privacy = new WatchPrivacyService(
			db as PrismaService,
			coordinator,
			{ restore: vi.fn().mockResolvedValue(pds.session) },
			{ indexTrackedMovie: vi.fn() } as unknown as MoviesService,
			{ indexTrackedEpisode: vi.fn() } as unknown as ShowsService,
		);
		pds.seed("xyz.opnshelf.movie", "watch-1", {
			$type: "xyz.opnshelf.movie",
			movieId: "runtime-1",
			source: "tmdb",
			watchedAt: "2026-01-02T12:00:00.000Z",
			createdAt: "2026-01-02T12:00:00.000Z",
			extension: { preserve: true },
		});
	});
	afterEach(async () => {
		await coordinator.deleteLocalAccount(did, async (tx) => {
			await tx.user.delete({ where: { did } });
		});
	});
	afterAll(async () => {
		await pool.end();
		await db.$disconnect();
	});
	it("moves both ways, hides pending and private owners, preserves identity and full values, cleans recovery snapshots", async () => {
		const original = structuredClone(
			pds.publicRecords.get("xyz.opnshelf.movie/watch-1"),
		);
		expect((await privacy.status(did, pds.session)).visibility).toBe("public");
		await privacy.start(did, pds.session, "private", false);
		expect(await db.user.count({ where: { did, ...publicWatchOwner } })).toBe(
			0,
		);
		await expect(coordinator.write(did, async () => {})).rejects.toThrow(
			"changing privacy",
		);
		await run();
		await run();
		expect(pds.publicRecords.size).toBe(0);
		expect(pds.privateRecords.get("xyz.opnshelf.movie/watch-1")).toEqual(
			original,
		);
		const local = await db.trackedMovie.findUniqueOrThrow({
			where: { userDid_rkey: { userDid: did, rkey: "watch-1" } },
		});
		expect(local.uri).toContain("/space/");
		expect((await privacy.status(did, pds.session)).visibility).toBe("private");
		const visible = await db.$queryRaw<{ count: bigint }[]>(
			Prisma.sql`SELECT COUNT(*) AS count FROM "TrackedMovie" tm WHERE tm."userDid" = ${did} AND ${publicWatchOwnerSql(Prisma.sql`tm."userDid"`)}`,
		);
		expect(Number(visible[0].count)).toBe(0);
		await expect(
			privacy.start(did, pds.session, "public", false),
		).rejects.toThrow("Confirm publication");
		expect(pds.publicRecords.size).toBe(0);
		await privacy.start(did, pds.session, "public", true);
		await run();
		await run();
		expect(pds.publicRecords.get("xyz.opnshelf.movie/watch-1")).toEqual(
			original,
		);
		expect(pds.privateRecords.size).toBe(0);
		const restored = await db.trackedMovie.findUniqueOrThrow({
			where: { userDid_rkey: { userDid: did, rkey: "watch-1" } },
		});
		expect(restored.id).toBe(local.id);
		expect(restored.uri).not.toContain("/space/");
		expect(
			await db.watchPrivacyCopy.count({ where: { job: { userDid: did } } }),
		).toBe(0);
		expect(await db.user.count({ where: { did, ...publicWatchOwner } })).toBe(
			1,
		);
	});
	it("retains a verified journal on failure and resumes the same migration safely", async () => {
		await privacy.start(did, pds.session, "private", false);
		pds.failNextDelete();
		await expect(run()).rejects.toThrow();
		const failed = await privacy.status(did, pds.session);
		expect(failed.migration?.status).toBe("failed");
		expect(failed.migration?.copied).toBe(1);
		expect(pds.publicRecords.size).toBe(1);
		expect(pds.privateRecords.size).toBe(1);
		await privacy.retry(did, pds.session);
		await run();
		await run();
		expect((await privacy.status(did, pds.session)).migration).toBeNull();
		expect(pds.publicRecords.size).toBe(0);
	});
	it("moves in both directions without Tranquil extension capabilities", async () => {
		pds.disableConditionalDelete();
		await privacy.start(did, pds.session, "private", false);
		await run();
		await run();
		await privacy.start(did, pds.session, "public", true);
		await run();
		await run();
		expect((await privacy.status(did, pds.session)).visibility).toBe("public");
		expect(pds.privateRecords.size).toBe(0);
	});
});
