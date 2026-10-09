import { WatchAccountLock } from "../privacy/watch-account-lock";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { parseEnvironment } from "../config/env.schema";
import { PrismaClient } from "../generated/client";
import type { PrismaService } from "../prisma/prisma.service";
import type { LocalSyncRecords } from "./local-records.service";
import { equivalent, mediaKey, type SyncRecord } from "./reconcile";
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
		write: vi.fn(async (_token: string, r: SyncRecord, remove = false) => {
			if (remove) {
				remoteRecords = remoteRecords.filter((v) => v.key !== r.key);
				return;
			}
			const previous =
				r.kind === "rating"
					? remoteRecords.find(
							(v) => v.kind === "rating" && v.mediaId === r.mediaId,
						)
					: undefined;
			if (previous) previous.value = r.value;
			else
				remoteRecords.push({
					...r,
					key: `${r.kind}:${++serial}`,
					rkey: undefined,
					cid: undefined,
					value:
						r.kind === "watch" && typeof r.value === "string"
							? new Date(
									Math.floor(Date.parse(r.value) / 60000) * 60000,
								).toISOString()
							: r.value,
				});
		}),
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
			) => {
				if (!desired) {
					localRecords = localRecords.filter((r) => r.key !== previous?.key);
					return null;
				}
				const record = {
					...desired,
					key: previous?.key ?? `movie:local-${desired.key}`,
					rkey: previous?.rkey ?? `local-${desired.key}`,
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
