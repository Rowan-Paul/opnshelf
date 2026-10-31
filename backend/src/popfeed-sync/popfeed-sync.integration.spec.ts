import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { parseEnvironment } from "../config/env.schema";
import { PrismaClient } from "../generated/client";
import type { SyncRecordTypes } from "../integrations/adapter";
import { contentValue, isContentRecord } from "../integrations/content-value";
import type { LocalSyncRecords } from "../integrations/local-records.service";
import { isListRecord, type SyncRecord } from "../integrations/reconcile";
import type { PrismaService } from "../prisma/prisma.service";
import { WatchAccountLock } from "../privacy/watch-account-lock";
import {
	LIST,
	type PopfeedRecord,
	popfeedRecords,
	type PopfeedRepository,
	REVIEW,
} from "./popfeed-records";
import { type PopfeedRepo, PopfeedWriter } from "./popfeed-writer";
import type {
	PopfeedCredential,
	PopfeedSyncClient,
} from "./popfeed-sync.client";
import type { PopfeedMediaService } from "./popfeed-media";
import { PopfeedSyncService } from "./popfeed-sync.service";

// Shares the disposable database used by the Trakt Sync persisted suite.
const url = process.env.TRAKT_SYNC_TEST_DATABASE_URL;
if (url && !["127.0.0.1", "localhost"].includes(new URL(url).hostname))
	throw new Error("Popfeed Sync integration tests require a local database");
describe.skipIf(!url)("Popfeed Sync persisted inbound reconciliation", () => {
	const db = new PrismaClient({
		adapter: new PrismaPg({ connectionString: url, max: 5 }),
	});
	const lockPool = new Pool({
		connectionString: url,
		max: 2,
		query_timeout: 5000,
		connectionTimeoutMillis: 5000,
	});
	const userDid = "did:plc:popfeed-sync-test";
	const repoUri = `at://${userDid}`;
	let repo: PopfeedRepository;
	let localRecords: SyncRecord[] = [];
	const remoteApi = {
		snapshot: vi.fn(async (c: PopfeedCredential, types: SyncRecordTypes) =>
			popfeedRecords(structuredClone(repo), types, c.timeZone),
		),
		readForRecord: vi.fn(async (_c: PopfeedCredential, record: SyncRecord) =>
			writer.read(record.kind),
		),
		write: vi.fn(
			async (
				_c: PopfeedCredential,
				record: SyncRecord,
				remove?: boolean,
				previous?: SyncRecord | null,
				onCreated?: (record: SyncRecord) => Promise<void>,
			) => writer.write(record, remove, previous, onCreated),
		),
	};
	let serial = 0;
	const collectionOf = (uri: string) => uri.split("/")[3];
	const memory: PopfeedRepo = {
		read: async () => structuredClone(repo),
		create: async (collection, record) => {
			const uri = `${repoUri}/${collection}/w${++serial}`;
			const entry = { uri, value: structuredClone(record) };
			if (collection === LIST) repo.lists.push(entry);
			else if (collection === REVIEW) repo.reviews.push(entry);
			else repo.listItems.push(entry);
			return uri;
		},
		put: async (uri, record) => {
			for (const records of [repo.lists, repo.reviews, repo.listItems])
				for (const entry of records)
					if (entry.uri === uri) entry.value = structuredClone(record);
		},
		remove: async (uri) => {
			const keep = (records: PopfeedRecord[]) =>
				records.filter((entry) => entry.uri !== uri);
			if (collectionOf(uri) === LIST) repo.lists = keep(repo.lists);
			else if (collectionOf(uri) === REVIEW) repo.reviews = keep(repo.reviews);
			else repo.listItems = keep(repo.listItems);
		},
		poster: async () => undefined,
	};
	const writer = new PopfeedWriter(
		memory,
		{
			media: async (type, id) => ({
				title: type === "movie" ? `Movie ${id}` : `Show ${id}`,
				genres: [],
			}),
		},
		"America/New_York",
	);
	const localApi = {
		validateMatch: vi.fn(async () => undefined),
		snapshot: vi.fn(async () => structuredClone(localRecords)),
		confirmDeleted: vi.fn(async () => undefined),
		write: vi.fn(
			async (
				_did: string,
				_connection: string,
				desired: SyncRecord | null,
				previous: SyncRecord | null,
				reservedRkey?: string,
			) => {
				if (!desired) {
					localRecords = localRecords.filter((r) => r.key !== previous?.key);
					return null;
				}
				const contained = isListRecord(desired) || isContentRecord(desired);
				const record = {
					...desired,
					key:
						previous?.key ??
						(contained
							? `${desired.kind}:${reservedRkey}`
							: `local:${desired.key}`),
				};
				localRecords = [
					...localRecords.filter((r) => r.key !== record.key),
					record,
				];
				return record;
			},
		),
	};
	const service = new PopfeedSyncService(
		db as unknown as PrismaService,
		remoteApi as unknown as PopfeedSyncClient,
		localApi as unknown as LocalSyncRecords,
		parseEnvironment({ NODE_ENV: "test" }),
		new WatchAccountLock(lockPool),
		{} as PopfeedMediaService,
		{ restore: async () => undefined },
	);
	// Never resolve a real DID document in tests.
	service["credential"] = async () => ({
		did: userDid,
		pds: "http://pds.invalid",
		timeZone: "America/New_York",
	});
	const item = (rkey: string, value: Record<string, unknown>) => ({
		uri: `${repoUri}/social.popfeed.feed.listItem/${rkey}`,
		value: {
			creativeWorkType: "movie",
			listType: "watched_movies",
			listUri: `${repoUri}/social.popfeed.feed.list/watched`,
			identifiers: { tmdbId: "120" },
			title: "Fixture Movie",
			addedAt: "2026-09-18T00:00:00.000Z",
			...value,
		},
	});
	const review = (rkey: string, value: Record<string, unknown>) => ({
		uri: `${repoUri}/social.popfeed.feed.review/${rkey}`,
		value: {
			creativeWorkType: "movie",
			identifiers: { tmdbId: "120" },
			title: "Fixture Movie",
			rating: 10,
			text: "",
			createdAt: "2026-09-18T00:00:02.000Z",
			...value,
		},
	});
	async function tick() {
		await db.integrationConnection.updateMany({
			where: { userDid },
			data: { nextRunAt: new Date(0), remoteReadAt: null },
		});
		await service.tick();
	}
	async function configure(types: SyncRecordTypes = {}) {
		await service.configure(userDid, {
			direction: "inbound",
			historyScope: "all",
			watches: true,
			ratings: true,
			publicationConsent: true,
			reviews: true,
			contentPublicationConsent: true,
			...types,
		});
		await tick();
	}
	async function settle() {
		for (let i = 0; i < 5; i++) await tick();
	}
	beforeEach(async () => {
		await db.user.deleteMany({ where: { did: userDid } });
		await db.user.create({
			data: {
				did: userDid,
				handle: "popfeed-sync-fixture.test",
				timezone: "America/New_York",
			},
		});
		repo = { listItems: [], reviews: [], lists: [] };
		localRecords = [];
		vi.clearAllMocks();
		await service.connect(userDid);
	});
	afterAll(async () => {
		await db.user.deleteMany({ where: { did: userDid } });
		await db.$disconnect();
		await lockPool.end();
	});

	it("brings Popfeed history into Opnshelf once, then stays quiet", async () => {
		repo.listItems = [
			item("m", {}),
			item("s", {
				creativeWorkType: "tv_show",
				listType: undefined,
				listUri: `${repoUri}/social.popfeed.feed.list/current`,
				identifiers: { tmdbId: "1920" },
				watchedEpisodes: [{ seasonNumber: 1, episodeNumber: 1 }],
			}),
		];
		repo.reviews = [review("r", { text: "Loved it", containsSpoilers: true })];
		await configure();
		await settle();
		const movie = localRecords.find(
			(r) => r.mediaType === "movie" && r.kind === "watch",
		);
		// A backdated log keeps its date in the owner's timezone.
		expect(movie).toMatchObject({
			mediaId: "120",
			value: "2026-09-18T16:00:00.000Z",
		});
		expect(localRecords.find((r) => r.mediaType === "episode")).toMatchObject({
			mediaId: "1920",
			season: 1,
			episode: 1,
			value: null,
		});
		expect(localRecords.find((r) => r.kind === "rating")?.value).toBe(10);
		const pulled = localRecords.find((r) => r.kind === "review");
		expect(pulled?.title).toBe("");
		expect(pulled && contentValue(pulled)).toMatchObject({
			content: "Loved it",
			spoiler: true,
		});
		const writes = localApi.write.mock.calls.length;
		expect(writes).toBe(4);
		await settle();
		expect(localApi.write).toHaveBeenCalledTimes(writes);
		expect(remoteApi.write).not.toHaveBeenCalled();
		expect((await service.status(userDid)).needsAttention).toBe(0);
	});

	it("links an existing Opnshelf Watch on the same day instead of duplicating it", async () => {
		localRecords = [
			{
				key: "movie:existing",
				kind: "watch",
				mediaType: "movie",
				mediaId: "120",
				season: 0,
				episode: 0,
				title: "Fixture Movie",
				// 21:20 on 18 September in New York.
				value: "2026-09-19T01:20:00.000Z",
			},
		];
		repo.listItems = [item("m", {})];
		await configure({ ratings: false, reviews: false });
		await settle();
		expect(localApi.write).not.toHaveBeenCalled();
		const entries = await db.integrationEntry.findMany({
			where: { connection: { userDid, provider: "popfeed" }, kind: "watch" },
		});
		expect(entries).toEqual([
			expect.objectContaining({ localKey: "movie:existing", linked: true }),
		]);
	});

	it("removes a synced Watch when it is removed on Popfeed, and nothing else", async () => {
		repo.listItems = [item("m", {})];
		const own: SyncRecord = {
			key: "movie:own",
			kind: "watch",
			mediaType: "movie",
			mediaId: "550",
			season: 0,
			episode: 0,
			title: "Logged in Opnshelf",
			value: "2026-01-01T20:00:00.000Z",
		};
		localRecords = [own];
		await configure({ ratings: false, reviews: false });
		await settle();
		expect(localRecords).toHaveLength(2);
		repo.listItems = [];
		await settle();
		expect(localRecords).toEqual([own]);
	});

	it("asks for a TMDB match when Popfeed has no TMDB ID", async () => {
		repo.listItems = [item("m", { identifiers: { imdbId: "tt1" } })];
		await configure({ ratings: false, reviews: false });
		await settle();
		expect(localApi.write).not.toHaveBeenCalled();
		const { items } = await service.listIssues(userDid, {});
		expect(items).toEqual([
			expect.objectContaining({
				kind: "watch",
				issue: "Choose a TMDB match for this title.",
				remote: expect.objectContaining({ title: "Fixture Movie" }),
			}),
		]);
	});

	it("needs Popfeed write access before sending changes to Popfeed", async () => {
		await expect(
			service.configure(userDid, {
				direction: "both",
				historyScope: "all",
				watches: true,
				ratings: true,
				publicationConsent: true,
			}),
		).rejects.toThrow("Allow Opnshelf to write your Popfeed records");
	});

	describe("in both directions", () => {
		const own = (key: string, value: string, mediaId = "120"): SyncRecord => ({
			key,
			kind: "watch",
			mediaType: "movie",
			mediaId,
			season: 0,
			episode: 0,
			title: "Logged in Opnshelf",
			value,
		});
		async function both(types: SyncRecordTypes = {}) {
			await db.user.update({
				where: { did: userDid },
				data: { popfeedWriteEnabled: true },
			});
			await service.configure(userDid, {
				direction: "both",
				historyScope: "all",
				watches: true,
				ratings: false,
				publicationConsent: true,
				...types,
			});
			await settle();
		}
		it("sends an Opnshelf Watch to Popfeed once, then stays quiet", async () => {
			localRecords = [own("movie:own", "2026-10-30T20:15:00.000Z")];
			await both();
			expect(repo.listItems).toHaveLength(1);
			expect(repo.listItems[0].value).toMatchObject({
				listType: "watched_movies",
				addedAt: "2026-10-30T20:15:00.000Z",
				identifiers: { tmdbId: "120" },
			});
			expect(repo.lists[0].value).toMatchObject({ listType: "watched_movies" });
			const writes = remoteApi.write.mock.calls.length;
			await settle();
			expect(remoteApi.write).toHaveBeenCalledTimes(writes);
			expect(localApi.write).not.toHaveBeenCalled();
			expect((await service.status(userDid)).needsAttention).toBe(0);
		});
		it("links a dated Opnshelf episode to Popfeed's undated one without asking", async () => {
			localRecords = [
				{
					...own("episode:own", "2026-10-29T21:00:00.000Z", "1920"),
					mediaType: "episode",
					season: 1,
					episode: 1,
				},
			];
			repo.listItems = [
				item("s", {
					creativeWorkType: "tv_show",
					listType: undefined,
					identifiers: { tmdbId: "1920" },
					watchedEpisodes: [{ seasonNumber: 1, episodeNumber: 1 }],
				}),
			];
			await both();
			expect(remoteApi.write).not.toHaveBeenCalled();
			expect(localApi.write).not.toHaveBeenCalled();
			expect((await service.status(userDid)).needsAttention).toBe(0);
		});
		it("keeps a movie rewatch in Needs attention instead of duplicating it", async () => {
			localRecords = [
				own("movie:first", "2026-01-01T20:00:00.000Z"),
				own("movie:second", "2026-10-30T20:00:00.000Z"),
			];
			await both();
			expect(repo.listItems).toHaveLength(1);
			const { items } = await service.listIssues(userDid, {});
			expect(items).toEqual([
				expect.objectContaining({
					issue: expect.stringContaining("one watched entry per movie"),
				}),
			]);
		});
		it("carries Rating edits and removals both ways", async () => {
			const rating = (value: number): SyncRecord => ({
				key: "rating:own",
				kind: "rating",
				mediaType: "movie",
				mediaId: "120",
				season: 0,
				episode: 0,
				title: "Fixture Movie",
				value,
			});
			localRecords = [rating(8)];
			await both({ watches: false, ratings: true });
			expect(
				repo.reviews.map((r) => (r.value as { rating: number }).rating),
			).toEqual([8]);
			localRecords = [rating(9)];
			await settle();
			expect(
				repo.reviews.map((r) => (r.value as { rating: number }).rating),
			).toEqual([9]);
			// A change made in Popfeed comes back into Opnshelf.
			(repo.reviews[0].value as { rating: number }).rating = 6;
			await settle();
			expect(localRecords.find((r) => r.kind === "rating")?.value).toBe(6);
			localRecords = [];
			await settle();
			expect(repo.reviews).toEqual([]);
		});
	});
});
