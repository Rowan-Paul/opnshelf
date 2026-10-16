import { encodeContent, isContentRecord } from "./content-value";
import { WatchAccountLock } from "../privacy/watch-account-lock";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { parseEnvironment } from "../config/env.schema";
import { PrismaClient } from "../generated/client";
import type { PrismaService } from "../prisma/prisma.service";
import type { LocalSyncRecords } from "./local-records.service";
import { encodeList, listValue, type ListMember } from "./list-value";
import {
	equivalent,
	mediaKey,
	isListRecord,
	type SyncRecord,
} from "./reconcile";
import { type TraktSyncClient, TraktSyncError } from "./trakt-sync.client";
import { TraktImportJobStore } from "../users/import/trakt-import-job.store";
import { TraktSyncService } from "./trakt-sync.service";

const url = process.env.TRAKT_SYNC_TEST_DATABASE_URL;
if (url && !["127.0.0.1", "localhost"].includes(new URL(url).hostname))
	throw new Error(
		"Trakt Sync integration tests require a disposable local database",
	);
describe.skipIf(!url)("Trakt Sync persisted reconciliation", () => {
	const db = new PrismaClient({
		adapter: new PrismaPg({ connectionString: url, max: 5 }),
	});
	const lockPool = new Pool({
		connectionString: url,
		max: 2,
		query_timeout: 5000,
		connectionTimeoutMillis: 5000,
	});
	const locks = new WatchAccountLock(lockPool);
	const userDid = "did:plc:trakt-sync-test";
	let localRecords: SyncRecord[] = [];
	let remoteRecords: SyncRecord[] = [];
	let serial = 100;
	const remoteApi = {
		configured: true,
		callbackUrl: "http://localhost/trakt-sync/callback",
		clientId: "fixture-client",
		exchange: vi.fn(async () => ({
			access_token: "fixture-access",
			refresh_token: "fixture-refresh",
			expires_in: 604800,
			created_at: Math.floor(Date.now() / 1000),
		})),
		profile: vi.fn(async () => ({
			username: "fixture",
			ids: { uuid: "fixture-account" },
		})),
		revoke: vi.fn(async () => undefined),
		snapshot: vi.fn(async () => structuredClone(remoteRecords)),
		readForRecord: vi.fn(async (_token: string, record: SyncRecord) =>
			structuredClone(
				remoteRecords.filter((r) =>
					record.kind === "rating"
						? r.kind === "rating" && r.mediaType === record.mediaType
						: mediaKey(r) === mediaKey(record),
				),
			),
		),
		write: vi.fn(
			async (
				_token: string,
				r: SyncRecord,
				remove = false,
				_previous?: SyncRecord | null,
				onCreated?: (record: SyncRecord) => Promise<void>,
			) => {
				if (remove) {
					remoteRecords = remoteRecords.filter((v) => v.key !== r.key);
					return;
				}
				const previous =
					(isListRecord(r) || isContentRecord(r)) && r.traktId
						? remoteRecords.find(
								(v) => v.kind === r.kind && v.traktId === r.traktId,
							)
						: r.kind === "rating"
							? remoteRecords.find(
									(v) => v.kind === "rating" && v.mediaId === r.mediaId,
								)
							: undefined;
				if (previous) {
					previous.value = r.value;
					previous.title = r.title;
				} else
					remoteRecords.push({
						...r,
						key: `${r.kind}:${++serial}`,
						traktId: isListRecord(r) || isContentRecord(r) ? serial : r.traktId,
						rkey: undefined,
						cid: undefined,
						value:
							r.kind === "watch" && typeof r.value === "string"
								? new Date(
										Math.floor(Date.parse(r.value) / 60000) * 60000,
									).toISOString()
								: r.value,
					});
				const created = remoteRecords.at(-1);
				if ((isListRecord(r) || isContentRecord(r)) && !previous && created)
					await onCreated?.(created);
			},
		),
	};
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
				const record = {
					...desired,
					key:
						previous?.key ??
						(isListRecord(desired) || isContentRecord(desired)
							? `${desired.kind}:${reservedRkey}`
							: `movie:local-${desired.key}`),
					rkey:
						previous?.rkey ??
						(isListRecord(desired) || isContentRecord(desired)
							? reservedRkey
							: `local-${desired.key}`),
				};
				localRecords = [
					...localRecords.filter((r) => r.key !== record.key),
					record,
				];
				return record;
			},
		),
	};
	const config = parseEnvironment({
		NODE_ENV: "test",
		TRAKT_API_KEY: "fixture-client",
		BACKEND_PUBLIC_URL: "http://localhost",
		FRONTEND_URL: "http://localhost:3000",
		PROVIDER_STATE_SECRET: "local-fixture-key-not-an-actual-credential-123456",
	});
	const service = new TraktSyncService(
		db as unknown as PrismaService,
		remoteApi as unknown as TraktSyncClient,
		localApi as unknown as LocalSyncRecords,
		config,
		locks,
	);
	const watch = (
		key: string,
		value: string | null = "2020-01-01T12:00:25.000Z",
	): SyncRecord => ({
		key,
		kind: "watch",
		mediaType: "movie",
		mediaId: "12",
		title: "Fixture movie",
		season: 0,
		episode: 0,
		value,
		rkey: key,
	});
	async function connect() {
		const { url: authUrl } = await service.authorize(userDid, "web");
		return service.callback(
			new URL(authUrl).searchParams.get("state") ?? "missing-state",
			"fixture-code",
		);
	}
	async function configure(
		historyScope: "all" | "future" = "all",
		direction: "both" | "inbound" | "outbound" = "both",
	) {
		await service.configure(userDid, {
			direction,
			historyScope,
			watches: true,
			ratings: true,
			publicationConsent: true,
		});
		await tick();
	}
	async function tick() {
		await db.traktSyncConnection.updateMany({
			where: { userDid },
			data: { nextRunAt: new Date(0), remoteReadAt: null },
		});
		await service.tick();
	}
	beforeEach(async () => {
		await db.watchPrivacyMigration.deleteMany({ where: { userDid } });
		await db.user.deleteMany({ where: { did: userDid } });
		await db.authState.deleteMany({ where: { key: { startsWith: "trakt:" } } });
		await db.backgroundJob.deleteMany({ where: { userDid } });
		await db.user.create({
			data: { did: userDid, handle: "trakt-sync-fixture.test" },
		});
		localRecords = [];
		remoteRecords = [];
		vi.clearAllMocks();
		await connect();
	});
	afterAll(async () => {
		await db.watchPrivacyMigration.deleteMany({ where: { userDid } });
		await db.user.deleteMany({ where: { did: userDid } });
		await db.backgroundJob.deleteMany({ where: { userDid } });
		await db.$disconnect();
		await lockPool.end();
	});
	const membership = (id: string): ListMember => ({
		mediaType: "movie",
		mediaId: id,
		season: 0,
		episode: 0,
		notes: "",
	});
	const curated = (
		key: string,
		members: string[],
		kind: "list" | "watchlist" | "favorites" = "list",
	): SyncRecord => ({
		key,
		rkey: key.split(":")[1],
		kind,
		mediaType: "list",
		mediaId: null,
		season: 0,
		episode: 0,
		title:
			kind === "watchlist"
				? "Watchlist"
				: kind === "favorites"
					? "Favorites"
					: "Weekend",
		visibility: "private",
		value: encodeList({
			name:
				kind === "watchlist"
					? "Watchlist"
					: kind === "favorites"
						? "Favorites"
						: "Weekend",
			description: "",
			items: members.map(membership),
		}),
	});
	async function configureLists(
		direction: "inbound" | "outbound" | "both",
		kind: "list" | "watchlist" | "favorites" = "list",
	) {
		await service.configure(userDid, {
			direction,
			watches: false,
			ratings: false,
			lists: kind === "list",
			watchlist: kind === "watchlist",
			favorites: kind === "favorites",
			listPublicationConsent: true,
			publicationConsent: false,
			historyScope: "all",
		});
		await tick();
	}
	it("pairs default Favorites by role and keeps custom Lists separate", async () => {
		localRecords = [
			{
				...curated("favorites:local", ["12"], "favorites"),
				title: "Renamed locally",
			},
		];
		remoteRecords = [
			curated("favorites:trakt", ["12", "13"], "favorites"),
			curated("list:22", ["99"]),
		];
		await configureLists("inbound", "favorites");
		await tick();
		expect(localRecords).toHaveLength(1);
		expect(listValue(localRecords[0]).items.map((i) => i.mediaId)).toEqual([
			"12",
			"13",
		]);
		expect(localRecords[0].key).toBe("favorites:local");
		expect(
			await db.traktSyncEntry.count({
				where: { connection: { userDid }, kind: "list", eligible: true },
			}),
		).toBe(0);
	});
	it("requires a source choice for initial two-way Favorites differences", async () => {
		localRecords = [curated("favorites:local", ["12"], "favorites")];
		remoteRecords = [curated("favorites:trakt", ["13"], "favorites")];
		await configureLists("both", "favorites");
		await tick();
		expect(listValue(localRecords[0]).items.map((i) => i.mediaId)).toEqual([
			"12",
		]);
		expect((await service.status(userDid)).needsAttention).toBe(1);
	});
	const content = (
		kind: "note" | "library" | "review",
		key: string,
		text = "Source words",
	): SyncRecord => ({
		key,
		kind,
		mediaType: "movie",
		mediaId: "12",
		season: 0,
		episode: 0,
		title: "Fixture",
		visibility: kind === "note" ? "private" : "public",
		value: encodeContent(
			kind === "library"
				? { format: "dvd" }
				: {
						content:
							kind === "review" && text === "Source words"
								? "word ".repeat(200).trim()
								: text,
						spoiler: false,
					},
		),
		traktId: 22,
	});
	async function configureContent(
		direction: "inbound" | "outbound" | "both",
		kind: "note" | "library" | "review",
		consent = true,
	) {
		await service.configure(userDid, {
			direction,
			watches: false,
			ratings: false,
			notes: kind === "note",
			library: kind === "library",
			reviews: kind === "review",
			contentPublicationConsent: consent,
			publicationConsent: false,
			historyScope: "all",
		});
		await tick();
	}
	it.each(["note", "library", "review"] as const)(
		"imports %s with a durable local identity and propagates linked deletions",
		async (kind) => {
			remoteRecords = [content(kind, `${kind}:22`)];
			await configureContent("inbound", kind);
			await tick();
			expect(localRecords).toHaveLength(1);
			expect(localRecords[0].key).toMatch(new RegExp(`^${kind}:`));
			remoteRecords = [];
			await tick();
			expect(localRecords).toEqual([]);
		},
	);
	it.each(["note", "library", "review"] as const)(
		"exports %s and propagates a linked local deletion",
		async (kind) => {
			localRecords = [content(kind, `${kind}:local`)];
			await configureContent("outbound", kind);
			await tick();
			expect(remoteRecords).toHaveLength(1);
			const linked = structuredClone(remoteRecords[0]);
			remoteApi.write.mockClear();
			localRecords = [];
			await tick();
			expect(remoteApi.write).toHaveBeenCalledWith(
				"fixture-access",
				linked,
				true,
			);
			expect(remoteRecords).toEqual([]);
			expect((await service.status(userDid)).needsAttention).toBe(0);
		},
	);
	it.each(["note", "review"] as const)(
		"names the %s when its outbound creation outcome is unknown",
		async (kind) => {
			localRecords = [content(kind, `${kind}:local`)];
			remoteApi.write.mockRejectedValueOnce(
				new Error("Connection interrupted"),
			);
			await configureContent("outbound", kind);
			await tick();
			const interrupted = await service.issues(userDid, { view: "attention" });
			await service.resolve(userDid, interrupted.items[0].id, {
				action: "retry",
			});
			await tick();
			const issues = await service.issues(userDid, { view: "attention" });
			expect(JSON.stringify(issues.items)).toContain(
				`whether Trakt created this ${kind === "note" ? "Note" : "Review"}`,
			);
			expect(remoteRecords).toEqual([]);
		},
	);
	it("keeps short Reviews actionable without an uncertain creation intent", async () => {
		localRecords = [content("review", "review:short", "A short review")];
		await configureContent("outbound", "review");
		await tick();
		await tick();
		expect(remoteApi.write).not.toHaveBeenCalled();
		const issue = (await service.issues(userDid, { view: "attention" }))
			.items[0];
		expect(issue.issue).toContain("200 words");
		expect(issue.recovery).toBe("retry");
		expect(
			(await db.traktSyncEntry.findUniqueOrThrow({ where: { id: issue.id } }))
				.pending,
		).toBeNull();
	});
	it("repairs legacy short-Review intents instead of asking for a missing version", async () => {
		localRecords = [content("review", "review:short", "A short review")];
		await configureContent("outbound", "review");
		const entry = await db.traktSyncEntry.findFirstOrThrow({
			where: { kind: "review" },
		});
		await db.traktSyncEntry.update({
			where: { id: entry.id },
			data: {
				pending: {
					direction: "push",
					desired: localRecords[0],
					previous: null,
					source: localRecords[0],
				},
			},
		});
		await tick();
		expect(
			(await service.issues(userDid, { view: "attention" })).items[0],
		).toMatchObject({ recovery: "retry", traktState: "missing" });
		expect(
			(await db.traktSyncEntry.findUniqueOrThrow({ where: { id: entry.id } }))
				.pending,
		).toBeNull();
		expect(remoteApi.write).not.toHaveBeenCalled();
	});
	it.each(["note", "review"] as const)(
		"adopts a uniquely confirmed %s after losing the creation acknowledgement",
		async (kind) => {
			localRecords = [content(kind, `${kind}:local`)];
			remoteApi.write.mockImplementationOnce(async (_token, desired) => {
				remoteRecords = [{ ...desired, key: `${kind}:77`, traktId: 77 }];
				throw new Error("Acknowledgement lost");
			});
			await configureContent("outbound", kind);
			await tick();
			await tick();
			expect(remoteApi.write).toHaveBeenCalledTimes(1);
			expect(remoteRecords).toHaveLength(1);
			expect((await service.status(userDid)).needsAttention).toBe(0);
			expect(
				await db.traktSyncEntry.findFirstOrThrow({ where: { kind } }),
			).toMatchObject({ remoteKey: `${kind}:77`, linked: true, pending: null });
		},
	);
	it("matches only same-kind content peers with the same parent and media family", async () => {
		remoteRecords = [
			{
				...content("note", "note:7"),
				traktId: 7,
				traktParentId: 42,
				mediaId: null,
			},
			{
				...content("note", "note:8"),
				traktId: 8,
				traktParentId: 42,
				mediaId: null,
			},
			{
				...content("note", "note:show"),
				traktId: 9,
				traktParentId: 42,
				mediaType: "show",
				mediaId: null,
			},
			{
				...content("note", "note:other"),
				traktId: 10,
				traktParentId: 99,
				mediaId: null,
			},
			{ ...watch("watch:7"), traktId: 7, traktParentId: 7, mediaId: null },
			{
				...watch("rating:7"),
				kind: "rating",
				value: 7,
				traktId: 7,
				traktParentId: 7,
				mediaId: null,
			},
			{
				...content("library", "library:7"),
				traktId: 7,
				traktParentId: 7,
				mediaId: null,
			},
			{
				...content("review", "review:42"),
				traktId: 42,
				traktParentId: 42,
				mediaId: null,
			},
		];
		await service.configure(userDid, {
			direction: "inbound",
			historyScope: "future",
			watches: true,
			ratings: true,
			notes: true,
			library: true,
			reviews: true,
			publicationConsent: true,
			contentPublicationConsent: true,
		});
		await tick();
		const entries = await db.traktSyncEntry.findMany({
			where: { connection: { userDid } },
		});
		const selected = entries.find((e) => e.remoteKey === "note:7");
		if (!selected) throw new Error("Missing Note issue");
		await service.resolve(userDid, selected.id, {
			action: "match",
			mediaId: "99",
		});
		for (const entry of entries) {
			const actual = await db.traktSyncEntry.findUniqueOrThrow({
				where: { id: entry.id },
			});
			if (["note:7", "note:8"].includes(entry.remoteKey ?? ""))
				expect(actual).toMatchObject({
					remoteBase: { mediaId: "99" },
					eligible: true,
					issue: null,
				});
			else
				expect(actual).toMatchObject({
					remoteBase: entry.remoteBase,
					eligible: entry.eligible,
					issue: entry.issue,
				});
		}
	});
	it("requires new content consent even when Watch and List consent exist", async () => {
		await configureLists("inbound");
		await expect(configureContent("inbound", "note", false)).rejects.toThrow(
			"Notes, Library Items and Reviews may become public",
		);
	});
	it("keeps initial conflicting Notes for an explicit source choice", async () => {
		localRecords = [content("note", "note:local", "Local words")];
		remoteRecords = [content("note", "note:22", "Remote words")];
		await configureContent("both", "note");
		await tick();
		expect(localApi.write).not.toHaveBeenCalled();
		expect((await service.status(userDid)).needsAttention).toBe(1);
		const issues = await service.issues(userDid, { view: "attention" });
		expect(issues.items[0].opnshelf?.displayValue).toBe("Local words");
		expect(issues.items[0].trakt?.displayValue).toBe("Remote words");
	});
	it("does not reuse a show's Note mapping for a movie with the same Trakt numeric ID", async () => {
		remoteRecords = [
			{
				...content("note", "note:22"),
				mediaType: "show",
				mediaId: "34",
				traktParentId: 22,
			},
		];
		await configureContent("inbound", "note");
		await tick();
		remoteRecords.push({
			...content("note", "note:23"),
			mediaId: null,
			traktId: 23,
			traktParentId: 22,
		});
		await tick();
		expect(localRecords).toHaveLength(1);
		expect((await service.status(userDid)).needsAttention).toBe(1);
	});
	it("keeps ownership with a missing format visible without inventing a Library Item", async () => {
		remoteRecords = [
			{
				...content("library", "library:movie:22"),
				value: encodeContent({}),
				problem: "Trakt did not supply a supported ownership format.",
			},
		];
		await configureContent("inbound", "library");
		await tick();
		expect(localRecords).toEqual([]);
		expect((await service.status(userDid)).needsAttention).toBe(1);
	});
	it("requires fresh List publication consent even after Watch consent", async () => {
		await configure();
		await expect(
			service.configure(userDid, {
				direction: "both",
				watches: true,
				ratings: true,
				lists: true,
				publicationConsent: true,
				historyScope: "all",
			}),
		).rejects.toThrow("List contents may become public");
	});
	it("imports private custom Lists and follows their stable link through renames", async () => {
		remoteRecords = [{ ...curated("list:22", ["12"]), traktId: 22 }];
		await configureLists("inbound");
		await tick();
		expect(localRecords).toHaveLength(1);
		const identity = localRecords[0].key;
		remoteRecords[0] = {
			...remoteRecords[0],
			title: "Renamed",
			value: encodeList({
				...listValue(remoteRecords[0]),
				name: "Renamed",
				items: [membership("13"), membership("12")],
			}),
		};
		await tick();
		expect(localRecords).toHaveLength(1);
		expect(localRecords[0].key).toBe(identity);
		expect(listValue(localRecords[0]).name).toBe("Renamed");
		expect(listValue(localRecords[0]).items.map((i) => i.mediaId)).toEqual([
			"13",
			"12",
		]);
	});
	it("preserves unrelated memberships through one-way source edits and removals", async () => {
		localRecords = [curated("list:local", ["99"])];
		remoteRecords = [{ ...curated("list:22", ["12"]), traktId: 22 }];
		await configureLists("inbound");
		await tick();
		expect(listValue(localRecords[0]).items.map((i) => i.mediaId)).toEqual([
			"12",
			"99",
		]);
		localApi.write.mockClear();
		await tick();
		expect(localApi.write).not.toHaveBeenCalled();
		remoteRecords[0] = {
			...remoteRecords[0],
			value: encodeList({ ...listValue(remoteRecords[0]), items: [] }),
		};
		await tick();
		expect(listValue(localRecords[0]).items.map((i) => i.mediaId)).toEqual([
			"99",
		]);
	});
	it("requires a choice for initial two-way List differences, then updates the paired List", async () => {
		localRecords = [curated("list:local", ["12"])];
		remoteRecords = [{ ...curated("list:22", ["13"]), traktId: 22 }];
		await configureLists("both");
		await tick();
		expect(remoteApi.write).not.toHaveBeenCalled();
		const issues = await service.issues(userDid, {});
		expect(issues.items).toHaveLength(1);
		expect(issues.items[0].issue).toContain("List");
		expect(issues.items[0].candidates).toEqual([]);
		await service.resolve(userDid, issues.items[0].id, { action: "opnshelf" });
		await tick();
		expect(remoteRecords).toHaveLength(1);
		expect(remoteRecords[0].key).toBe("list:22");
		expect(equivalent(remoteRecords[0], localRecords[0])).toBe(true);
	});
	it("propagates Trakt automatic watchlist removals as membership changes", async () => {
		localRecords = [curated("watchlist:local", ["12"], "watchlist")];
		remoteRecords = [curated("watchlist:trakt", ["12"], "watchlist")];
		await configureLists("inbound", "watchlist");
		await tick();
		remoteRecords = [curated("watchlist:trakt", [], "watchlist")];
		await tick();
		expect(localRecords).toHaveLength(1);
		expect(listValue(localRecords[0]).items).toEqual([]);
	});
	it("propagates a linked custom List deletion without deleting unrelated Lists", async () => {
		localRecords = [
			curated("list:local", ["12"]),
			{
				...curated("list:unrelated", ["99"]),
				title: "Other",
				value: encodeList({
					name: "Other",
					description: "",
					items: [membership("99")],
				}),
			},
		];
		remoteRecords = [{ ...curated("list:22", ["12"]), traktId: 22 }];
		await configureLists("inbound");
		await tick();
		remoteRecords = [];
		await tick();
		expect(localRecords.map((r) => r.key)).toEqual(["list:unrelated"]);
	});
	it("holds Watch sync and recovery when the Shelf is private", async () => {
		remoteRecords = [watch("remote-private")];
		await db.user.update({
			where: { did: userDid },
			data: { watchVisibility: "private" },
		});
		await configure();
		expect(remoteApi.snapshot).not.toHaveBeenCalled();
		expect(localApi.write).not.toHaveBeenCalled();
		const recovery = vi.fn(async () => undefined);
		await expect(service.recoverImport(userDid, recovery)).rejects.toThrow(
			"public Shelf",
		);
		expect(recovery).not.toHaveBeenCalled();
	});
	it("holds Watch sync while a privacy migration is pending", async () => {
		const job = await db.backgroundJob.create({
			data: { userDid, type: "watch_privacy" },
		});
		await db.watchPrivacyMigration.create({
			data: {
				jobId: job.id,
				userDid,
				sourceVisibility: "public",
				targetVisibility: "private",
			},
		});
		await configure();
		expect(remoteApi.snapshot).not.toHaveBeenCalled();
		expect(localApi.write).not.toHaveBeenCalled();
	});

	it("continues Ratings on a private Shelf when Watches are disabled", async () => {
		await db.user.update({
			where: { did: userDid },
			data: { watchVisibility: "private" },
		});
		localRecords = [watch("private-watch")];
		remoteRecords = [{ ...watch("rating:12"), kind: "rating", value: 8 }];
		await service.configure(userDid, {
			direction: "both",
			historyScope: "all",
			watches: false,
			ratings: true,
			publicationConsent: true,
		});
		await tick();
		await tick();
		expect(localApi.write).toHaveBeenCalledTimes(1);
		expect(remoteApi.write).not.toHaveBeenCalled();
	});
	it("waits for an account operation before reading or transferring history", async () => {
		await service.configure(userDid, {
			direction: "both",
			historyScope: "all",
			watches: true,
			ratings: true,
			publicationConsent: true,
		});
		await locks.run(userDid, async () => {
			await tick();
			expect(remoteApi.snapshot).not.toHaveBeenCalled();
		});
		await tick();
		expect(remoteApi.snapshot).toHaveBeenCalledTimes(1);
	});

	it("encrypts credentials, consumes authorization state once, and starts paused", async () => {
		const c = await db.traktSyncConnection.findFirstOrThrow({
			where: { userDid },
		});
		expect(c.accessToken).not.toBe("fixture-access");
		expect(c.status).toBe("paused");
		const { url: authUrl } = await service.authorize(userDid, "web");
		const state = new URL(authUrl).searchParams.get("state") ?? "missing-state";
		await service.callback(state, "code");
		await expect(service.callback(state, "code")).resolves.toBe(
			"http://localhost:3000/trakt-sync?connection=failed",
		);
	});
	it("redirects callback errors to the trusted platform and consumes failed state", async () => {
		const { url } = await service.authorize(userDid, "mobile");
		const state = new URL(url).searchParams.get("state") ?? "";
		remoteApi.exchange.mockRejectedValueOnce(
			new Error("private provider failure"),
		);
		await expect(service.callback(state, "code")).resolves.toBe(
			"opnshelf://trakt-sync?connection=failed",
		);
		await expect(service.callback(state, "code")).resolves.toBe(
			"http://localhost:3000/trakt-sync?connection=failed",
		);
		const { url: expiredUrl } = await service.authorize(userDid, "mobile");
		const expired = new URL(expiredUrl).searchParams.get("state") ?? "";
		await db.authState.update({
			where: { key: `trakt:${expired}` },
			data: { expiresAt: new Date(0) },
		});
		await expect(service.callback(expired, "code")).resolves.toBe(
			"opnshelf://trakt-sync?connection=failed",
		);
	});
	it("returns to Onboarding when authorization starts there", async () => {
		const web = await service.authorize(userDid, "web", "onboarding");
		await expect(
			service.callback(
				new URL(web.url).searchParams.get("state") ?? "",
				undefined,
			),
		).resolves.toBe("http://localhost:3000/onboarding?connection=cancelled");
		const mobile = await service.authorize(userDid, "mobile", "onboarding");
		await expect(
			service.callback(
				new URL(mobile.url).searchParams.get("state") ?? "",
				undefined,
			),
		).resolves.toBe("opnshelf://onboarding?connection=cancelled");
	});
	it("disconnects for account deletion even when remote revocation fails", async () => {
		remoteApi.revoke.mockRejectedValueOnce(new Error("Trakt unavailable"));
		await service.disconnectForDeletion(userDid);
		const c = await db.traktSyncConnection.findFirstOrThrow({
			where: { userDid },
		});
		expect(c).toMatchObject({
			status: "disconnected",
			accessToken: null,
			refreshToken: null,
			expiresAt: null,
		});
	});
	it("does not remap a movie when a show has the same Trakt parent ID", async () => {
		remoteRecords = [
			{
				...watch("watch:movie"),
				mediaId: null,
				traktId: 42,
				traktParentId: 42,
			},
			{
				...watch("watch:episode"),
				mediaType: "episode",
				mediaId: null,
				season: 1,
				episode: 1,
				traktId: 77,
				traktParentId: 42,
			},
		];
		await configure("future");
		const movie = await db.traktSyncEntry.findFirstOrThrow({
			where: { remoteKey: "watch:movie" },
		});
		const episode = await db.traktSyncEntry.findFirstOrThrow({
			where: { remoteKey: "watch:episode" },
		});
		await service.resolve(userDid, episode.id, {
			action: "match",
			mediaId: "99",
		});
		expect(
			await db.traktSyncEntry.findUniqueOrThrow({ where: { id: movie.id } }),
		).toMatchObject({
			remoteBase: movie.remoteBase,
			eligible: false,
			issue: movie.issue,
		});
		expect(
			await db.traktSyncEntry.findUniqueOrThrow({ where: { id: episode.id } }),
		).toMatchObject({ remoteBase: { mediaId: "99" }, eligible: true });
	});
	it("confirms outbound writes with a scoped read and retains unrelated snapshot records", async () => {
		localRecords = [watch("local:1")];
		remoteRecords = [{ ...watch("watch:unrelated"), mediaId: "999" }];
		await configure("all", "outbound");
		remoteApi.snapshot.mockClear();
		await tick();
		expect(remoteApi.snapshot).toHaveBeenCalledTimes(1);
		expect(remoteApi.readForRecord).toHaveBeenCalledTimes(1);
		const c = await db.traktSyncConnection.findFirstOrThrow({
			where: { userDid },
		});
		expect(c.remoteSnapshot).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ key: "watch:unrelated" }),
				expect.objectContaining({ mediaId: "12" }),
			]),
		);
	});

	it("imports a Watch once and follows a linked remote deletion without echo writes", async () => {
		remoteRecords = [watch("watch:1")];
		await configure();
		await tick();
		expect(localRecords).toHaveLength(1);
		await tick();
		expect(localApi.write).toHaveBeenCalledTimes(1);
		expect(remoteApi.write).not.toHaveBeenCalled();
		remoteRecords = [];
		await tick();
		expect(localRecords).toHaveLength(0);
	});
	it("reports catch-up progress while a large inbound history transfers", async () => {
		remoteRecords = Array.from({ length: 25 }, (_, i) =>
			watch(`watch:${i}`, new Date(Date.UTC(2020, 0, i + 1)).toISOString()),
		);
		await configure("all", "inbound");
		await tick();
		expect(await service.status(userDid)).toMatchObject({
			remaining: 15,
			progress: 40,
		});
		await tick();
		expect(await service.status(userDid)).toMatchObject({
			remaining: 5,
			progress: 80,
		});
		await tick();
		const done = await service.status(userDid);
		expect(localRecords).toHaveLength(25);
		expect(done.remaining).toBe(0);
		expect(done.progress).toBeUndefined();
	});
	it("exports historical future additions and leaves the initial history excluded", async () => {
		localRecords = [watch("movie:old")];
		await configure("future");
		await tick();
		expect(remoteRecords).toHaveLength(0);
		localRecords.push(watch("movie:new", "1990-01-01T00:00:00Z"));
		await tick();
		expect(remoteRecords).toHaveLength(1);
		expect(equivalent(remoteRecords[0], localRecords[1])).toBe(true);
	});
	it("keeps initial Rating conflicts pending until the user chooses", async () => {
		localRecords = [{ ...watch("rating:one"), kind: "rating", value: 7 }];
		remoteRecords = [{ ...watch("rating:remote"), kind: "rating", value: 9 }];
		await configure();
		await tick();
		const issues = await service.issues(userDid, {});
		expect(issues.total).toBe(1);
		expect(remoteApi.write).not.toHaveBeenCalled();
		await service.resolve(userDid, issues.items[0].id, { action: "opnshelf" });
		await tick();
		expect(remoteRecords[0].value).toBe(7);
	});
	it("does not interpret an incomplete remote read as deletion", async () => {
		remoteRecords = [watch("watch:1")];
		await configure();
		await tick();
		remoteApi.snapshot.mockRejectedValueOnce(
			new TraktSyncError("incomplete page"),
		);
		await tick();
		expect(localRecords).toHaveLength(1);
		expect((await service.status(userDid)).lastError).toContain("incomplete");
	});
	it("recovers an uncertain outbound write without a duplicate Watch", async () => {
		localRecords = [watch("movie:one")];
		await configure();
		remoteApi.write.mockImplementationOnce(async (_token, record) => {
			remoteRecords.push({ ...record, key: "watch:lost-ack" });
			throw new Error("Lost acknowledgement");
		});
		await tick();
		await tick();
		expect(remoteRecords).toHaveLength(1);
		expect(remoteApi.write).toHaveBeenCalledTimes(1);
		expect((await service.issues(userDid, {})).total).toBe(0);
	});
	it("retains links across disconnect and catches up on reconnect", async () => {
		localRecords = [watch("movie:one")];
		await configure();
		await tick();
		const count = await db.traktSyncEntry.count();
		await service.action(userDid, "disconnect");
		expect(remoteApi.revoke).toHaveBeenCalled();
		expect(await db.traktSyncEntry.count()).toBe(count);
		localRecords[0].value = "2021-01-01T00:00:00Z";
		await connect();
		await configure("future");
		await tick();
		expect(remoteRecords).toHaveLength(1);
		expect(remoteRecords[0].value).toBe("2021-01-01T00:00:00.000Z");
	});
	it("requires explicit publication consent and an explicit unfinished Import handoff", async () => {
		await expect(
			service.configure(userDid, {
				direction: "inbound",
				historyScope: "all",
				watches: true,
				ratings: true,
				publicationConsent: false,
			}),
		).rejects.toThrow("public");
		const job = await db.backgroundJob.create({
			data: { type: "trakt_import", userDid, status: "paused" },
		});
		await expect(configure()).rejects.toThrow("Finish your Import");
		await service.configure(userDid, {
			direction: "both",
			historyScope: "all",
			watches: true,
			ratings: true,
			publicationConsent: true,
			handoffImport: true,
		});
		expect(
			(await db.backgroundJob.findUniqueOrThrow({ where: { id: job.id } }))
				.status,
		).toBe("continued_in_sync");
	});
	it.each([408, 499])(
		"keeps creation uncertain after HTTP %s interrupts the request",
		async (status) => {
			localRecords = [curated("list:local", ["12"])];
			await configureLists("outbound");
			remoteApi.write.mockRejectedValueOnce(
				new TraktSyncError("Request interrupted", status),
			);
			await tick();
			expect((await service.issues(userDid, {})).items[0]).toMatchObject({
				recovery: "verify",
				traktState: "unknown",
			});
		},
	);
	it("retries a rejected List creation without turning it into an uncertain write", async () => {
		localRecords = [curated("list:local", ["12"])];
		await configureLists("outbound");
		remoteApi.write.mockRejectedValueOnce(
			new TraktSyncError("Trakt rejected this List.", 422),
		);
		await tick();
		const issue = (await service.issues(userDid, {})).items[0];
		expect(issue.recovery).toBe("retry");
		await service.resolve(userDid, issue.id, { action: "retry" });
		await tick();
		expect(remoteRecords).toHaveLength(1);
		expect((await service.issues(userDid, {})).total).toBe(0);
	});
	it("does not allow choosing a missing remote version while creation is unconfirmed", async () => {
		localRecords = [curated("list:local", ["12"])];
		await configureLists("outbound");
		const entry = await db.traktSyncEntry.findFirstOrThrow({
			where: { connection: { userDid } },
		});
		await db.traktSyncEntry.update({
			where: { id: entry.id },
			data: {
				pending: {
					direction: "push",
					desired: localRecords[0],
					previous: null,
				},
				issue: "Unconfirmed creation",
			},
		});
		expect((await service.issues(userDid, {})).items[0]).toMatchObject({
			recovery: "verify",
			traktState: "unknown",
		});
		await expect(
			service.resolve(userDid, entry.id, { action: "trakt" }),
		).rejects.toThrow("unconfirmed transfer");
		expect(localRecords).toHaveLength(1);
	});
	it.each(["list", "note", "review"] as const)(
		"resends a missing %s only after an explicit Trakt check, including after edits and a direction change",
		async (kind) => {
			localRecords = [
				kind === "list"
					? curated("list:local", ["12"])
					: content(kind, `${kind}:local`),
			];
			if (kind === "list") await configureLists("outbound");
			else await configureContent("outbound", kind);
			remoteApi.write.mockRejectedValueOnce(
				new Error("Request never reached Trakt"),
			);
			await tick();
			const entry = await db.traktSyncEntry.findFirstOrThrow({
				where: { connection: { userDid }, kind },
			});
			for (let attempt = 0; attempt < 3; attempt++) {
				await service.resolve(userDid, entry.id, { action: "retry" });
				await tick();
			}
			expect(remoteApi.write).toHaveBeenCalledTimes(1);
			localRecords[0] = { ...localRecords[0], title: "Edited locally" };
			await tick();
			expect((await service.issues(userDid, {})).items[0].recovery).toBe(
				"verify",
			);
			expect(
				(await db.traktSyncEntry.findUniqueOrThrow({ where: { id: entry.id } }))
					.pending,
			).not.toBeNull();
			await db.traktSyncConnection.updateMany({
				where: { userDid },
				data: { direction: "inbound" },
			});
			await tick();
			await expect(
				service.resolve(userDid, entry.id, { action: "opnshelf" }),
			).rejects.toThrow("unconfirmed transfer");
			await service.resolve(userDid, entry.id, {
				action: "opnshelf",
				confirmedTraktMissing: true,
			});
			await tick();
			expect(remoteRecords).toHaveLength(1);
			expect(remoteRecords[0].title).toBe("Edited locally");
			expect(localRecords).toHaveLength(1);
			expect((await service.issues(userDid, {})).total).toBe(0);
		},
	);
	it.each(["note", "review"] as const)(
		"adopts the original %s before sending a local edit after an acknowledgement was lost",
		async (kind) => {
			localRecords = [content(kind, `${kind}:local`)];
			await configureContent("outbound", kind);
			remoteApi.write.mockImplementationOnce(async (_token, desired) => {
				remoteRecords = [{ ...desired, key: `${kind}:77`, traktId: 77 }];
				throw new Error("Acknowledgement lost");
			});
			await tick();
			localRecords[0] = {
				...localRecords[0],
				value: encodeContent({
					content: "edited ".repeat(200).trim(),
					spoiler: false,
				}),
			};
			await tick();
			expect(remoteRecords).toHaveLength(1);
			expect(remoteRecords[0].value).toBe(localRecords[0].value);
			expect(remoteApi.write).toHaveBeenCalledTimes(2);
			expect((await service.issues(userDid, {})).total).toBe(0);
		},
	);
	it.each(["trakt", "opnshelf"] as const)(
		"keeps an uncertain intent when a remote copy appears before confirming %s",
		async (action) => {
			localRecords = [content("review", "review:local")];
			await configureContent("outbound", "review");
			remoteApi.write.mockRejectedValueOnce(new Error("Acknowledgement lost"));
			await tick();
			const entry = await db.traktSyncEntry.findFirstOrThrow({
				where: { connection: { userDid }, kind: "review" },
			});
			remoteRecords = [{ ...localRecords[0], key: "review:77", traktId: 77 }];
			await expect(
				service.resolve(userDid, entry.id, {
					action,
					confirmedTraktMissing: true,
				}),
			).rejects.toThrow("possible copy");
			expect(
				(await db.traktSyncEntry.findUniqueOrThrow({ where: { id: entry.id } }))
					.pending,
			).not.toBeNull();
			expect(localRecords).toHaveLength(1);
			await tick();
			expect(remoteRecords).toHaveLength(1);
			expect(remoteApi.write).toHaveBeenCalledTimes(1);
			expect((await service.issues(userDid, {})).total).toBe(0);
		},
	);
	it("removes a local unconfirmed creation only after explicitly confirming the Trakt version is missing", async () => {
		localRecords = [curated("list:local", ["12"])];
		await configureLists("outbound");
		remoteApi.write.mockRejectedValueOnce(
			new Error("Request never reached Trakt"),
		);
		await tick();
		const entry = await db.traktSyncEntry.findFirstOrThrow({
			where: { connection: { userDid }, kind: "list" },
		});
		await service.resolve(userDid, entry.id, {
			action: "trakt",
			confirmedTraktMissing: true,
		});
		await tick();
		expect(localRecords).toEqual([]);
		expect(remoteRecords).toEqual([]);
	});
	it("recovers an uncertain List without treating an already-linked same-name List as its copy", async () => {
		localRecords = [curated("list:first", ["12"])];
		remoteRecords = [{ ...curated("list:22", ["12"]), traktId: 22 }];
		await configureLists("outbound");
		await tick();
		localRecords.push(curated("list:second", ["13"]));
		remoteApi.write.mockRejectedValueOnce(
			new Error("Request never reached Trakt"),
		);
		await tick();
		let entry = await db.traktSyncEntry.findFirstOrThrow({
			where: { connection: { userDid }, localKey: "list:second" },
		});
		// Initial same-name pairing needs an explicit source choice before export.
		await service.resolve(userDid, entry.id, { action: "opnshelf" });
		await tick();
		entry = await db.traktSyncEntry.findUniqueOrThrow({
			where: { id: entry.id },
		});
		expect(entry.pending).not.toBeNull();
		await service.resolve(userDid, entry.id, { action: "retry" });
		await tick();
		await service.resolve(userDid, entry.id, {
			action: "opnshelf",
			confirmedTraktMissing: true,
		});
		await tick();
		expect(remoteRecords).toHaveLength(2);
		expect(listValue(remoteRecords[0]).items.map((r) => r.mediaId)).toEqual([
			"12",
		]);
		expect((await service.issues(userDid, {})).total).toBe(0);
	});
	it.each(["watchlist", "rating"] as const)(
		"retries an interrupted %s after a local edit without a missing-copy acknowledgement",
		async (kind) => {
			localRecords = [
				kind === "watchlist"
					? curated("watchlist:local", ["12"], "watchlist")
					: { ...watch("rating:local"), kind: "rating", value: 7 },
			];
			if (kind === "watchlist") await configureLists("outbound", "watchlist");
			else await configure("all", "outbound");
			remoteApi.write.mockRejectedValueOnce(new Error("Request interrupted"));
			await tick();
			const entry = await db.traktSyncEntry.findFirstOrThrow({
				where: { connection: { userDid }, kind },
			});
			expect(entry.pending).not.toBeNull();
			localRecords[0] =
				kind === "watchlist"
					? curated("watchlist:local", ["13"], "watchlist")
					: { ...localRecords[0], value: 9 };
			await tick();
			expect((await service.issues(userDid, {})).items[0].recovery).toBe(
				"choose",
			);
			expect(
				(await db.traktSyncEntry.findUniqueOrThrow({ where: { id: entry.id } }))
					.pending,
			).toBeNull();
			await service.resolve(userDid, entry.id, { action: "retry" });
			await tick();
			expect(remoteRecords).toHaveLength(1);
			expect(remoteRecords[0].value).toBe(localRecords[0].value);
			expect((await service.issues(userDid, {})).total).toBe(0);
		},
	);
	it("reports an overdue provider retry as queued instead of waiting", async () => {
		await configure();
		await db.traktSyncConnection.updateMany({
			where: { userDid },
			data: { nextRunAt: new Date(0), lastError: "Trakt rate limit" },
		});
		expect(await service.status(userDid)).toMatchObject({
			syncState: "queued",
		});
	});
	it("keeps the scheduled retry when Sync now is pressed during a provider delay", async () => {
		await configure();
		const nextRunAt = new Date(Date.now() + 60_000);
		await db.traktSyncConnection.updateMany({
			where: { userDid },
			data: {
				nextRunAt,
				lastError: "Trakt rate limit reached. Sync will retry.",
			},
		});
		await expect(service.action(userDid, "sync")).resolves.toMatchObject({
			syncState: "waiting",
			nextCheckAt: nextRunAt.toISOString(),
		});
	});
	it("returns the running sync when Sync now is pressed repeatedly", async () => {
		await configure();
		await db.traktSyncConnection.updateMany({
			where: { userDid },
			data: {
				leaseId: "worker",
				leaseUntil: new Date(Date.now() + 60_000),
			},
		});
		await expect(service.action(userDid, "sync")).resolves.toMatchObject({
			syncState: "running",
		});
		await expect(service.action(userDid, "sync")).resolves.toMatchObject({
			syncState: "running",
		});
	});
	it("automatically adopts a fully confirmed interrupted List creation", async () => {
		localRecords = [curated("list:local", ["12"])];
		await configureLists("outbound");
		const connection = await db.traktSyncConnection.findFirstOrThrow({
			where: { userDid },
		});
		const entry = await db.traktSyncEntry.findFirstOrThrow({
			where: { connectionId: connection.id },
		});
		await db.traktSyncEntry.update({
			where: { id: entry.id },
			data: {
				pending: {
					direction: "push",
					desired: localRecords[0],
					previous: null,
				},
			},
		});
		remoteRecords = [{ ...localRecords[0], key: "list:22", traktId: 22 }];
		await tick();
		expect((await service.issues(userDid, {})).total).toBe(0);
		expect(remoteApi.write).not.toHaveBeenCalled();
		expect(
			await db.traktSyncEntry.findUniqueOrThrow({ where: { id: entry.id } }),
		).toMatchObject({ remoteKey: "list:22", linked: true, pending: null });
	});
	it("serializes controls against a worker lease and does not erase history on disconnect", async () => {
		await configure();
		const c = await db.traktSyncConnection.findFirstOrThrow({
			where: { userDid },
		});
		await db.traktSyncConnection.update({
			where: { id: c.id },
			data: {
				leaseId: "another-worker",
				leaseUntil: new Date(Date.now() + 60_000),
			},
		});
		await expect(service.action(userDid, "disconnect")).rejects.toThrow(
			"finishing",
		);
		expect(remoteApi.revoke).not.toHaveBeenCalled();
	});
	it("queues the first comparison instead of reading history in the settings request", async () => {
		await service.configure(userDid, {
			direction: "both",
			historyScope: "future",
			watches: true,
			ratings: true,
			publicationConsent: true,
		});
		expect(remoteApi.snapshot).not.toHaveBeenCalled();
		expect((await service.status(userDid)).status).toBe("preparing");
		await tick();
		expect((await service.status(userDid)).status).toBe("active");
	});
	it("refreshes stale Trakt data before pushing a concurrent Rating edit", async () => {
		localRecords = [{ ...watch("rating:one"), kind: "rating", value: 7 }];
		remoteRecords = [{ ...watch("rating:remote"), kind: "rating", value: 7 }];
		await configure();
		localRecords[0].value = 8;
		remoteRecords[0].value = 9;
		await db.traktSyncConnection.updateMany({
			where: { userDid },
			data: { nextRunAt: new Date(0) },
		});
		await service.tick();
		expect(remoteApi.write).not.toHaveBeenCalled();
		expect((await service.issues(userDid, {})).items[0].issue).toContain(
			"different Ratings",
		);
	});
	it("holds a replaced remote Watch for confirmation and preserves the local identity", async () => {
		remoteRecords = [watch("watch:1")];
		await configure();
		await tick();
		const original = localRecords[0].key;
		remoteRecords = [watch("watch:2", "2022-01-01T00:00:00Z")];
		await tick();
		expect(localRecords[0].key).toBe(original);
		const issues = await service.issues(userDid, {});
		const linked = issues.items.find((i) => i.opnshelf?.key === original);
		if (!linked) throw new Error("Expected a linked Watch conflict");
		expect(linked.candidates.map((r) => r.key)).toContain("watch:2");
		await service.resolve(userDid, linked.id, {
			action: "link",
			candidateKey: "watch:2",
		});
		await service.resolve(userDid, linked.id, { action: "trakt" });
		await tick();
		expect(localRecords).toHaveLength(1);
		expect(localRecords[0].key).toBe(original);
		expect(localRecords[0].value).toBe("2022-01-01T00:00:00Z");
	});
	it("requires confirmation for undated pairs and keeps ignored items recoverable", async () => {
		localRecords = [watch("movie:one", null)];
		remoteRecords = [watch("watch:1", null)];
		await configure();
		await tick();
		expect(localApi.write).not.toHaveBeenCalled();
		expect(remoteApi.write).not.toHaveBeenCalled();
		const item = (await service.issues(userDid, {})).items[0];
		await service.resolve(userDid, item.id, { action: "ignore" });
		expect((await service.status(userDid)).ignored).toBe(1);
		await service.resolve(userDid, item.id, { action: "undo" });
		expect((await service.status(userDid)).ignored).toBe(0);
		await service.resolve(userDid, item.id, {
			action: "link",
			candidateKey: item.candidates[0].key,
		});
		await tick();
		expect((await service.issues(userDid, {})).total).toBe(0);
	});
	it("clears an interrupted intent when the user explicitly selects another source", async () => {
		localRecords = [{ ...watch("rating:one"), kind: "rating", value: 7 }];
		remoteRecords = [{ ...watch("rating:remote"), kind: "rating", value: 9 }];
		await configure();
		await tick();
		const e = await db.traktSyncEntry.findFirstOrThrow({
			where: { connection: { userDid } },
		});
		await db.traktSyncEntry.update({
			where: { id: e.id },
			data: {
				pending: {
					direction: "push",
					desired: localRecords[0],
					previous: remoteRecords[0],
				},
			},
		});
		await service.resolve(userDid, e.id, { action: "trakt" });
		await tick();
		expect(localRecords[0].value).toBe(9);
		expect(remoteApi.write).not.toHaveBeenCalled();
	});
	it("enforces a single connected account in the database", async () => {
		await expect(
			db.traktSyncConnection.create({
				data: { userDid, traktUserId: "another", username: "another" },
			}),
		).rejects.toThrow();
		await service.action(userDid, "disconnect");
		await expect(
			db.traktSyncConnection.create({
				data: { userDid, traktUserId: "another", username: "another" },
			}),
		).resolves.toBeDefined();
	});
	it("keeps a handed-off Import permanently retired even after a stale worker or Resume", async () => {
		const job = await db.backgroundJob.create({
			data: { userDid, type: "trakt_import", status: "continued_in_sync" },
		});
		const store = new TraktImportJobStore(db as unknown as PrismaService);
		await store.persistStatusControl(job.id, "resume");
		await store.persistWorkerState(job.id, undefined, {
			status: "completed",
			nextRunAt: new Date(),
			completedAt: new Date(),
			lastError: null,
		});
		expect(
			(await db.backgroundJob.findUniqueOrThrow({ where: { id: job.id } }))
				.status,
		).toBe("continued_in_sync");
	});
	it("adopts a legacy recovery that reached the PDS before its link was saved", async () => {
		remoteRecords = [watch("watch:1")];
		await configure();
		localRecords = [watch("movie:legacy-recovery")];
		await tick();
		expect(localApi.write).not.toHaveBeenCalled();
		expect(remoteApi.write).not.toHaveBeenCalled();
		expect(
			await db.traktSyncEntry.count({
				where: {
					connection: { userDid },
					linked: true,
					localKey: "movie:legacy-recovery",
					remoteKey: "watch:1",
				},
			}),
		).toBe(1);
	});
	it("revokes on account deletion and cascades sync state without removing exports", async () => {
		localRecords = [watch("movie:one")];
		await configure();
		await tick();
		await service.disconnectForDeletion(userDid);
		await db.user.delete({ where: { did: userDid } });
		expect(remoteApi.revoke).toHaveBeenCalled();
		expect(await db.traktSyncEntry.count()).toBe(0);
		expect(remoteRecords).toHaveLength(1);
	});
});
