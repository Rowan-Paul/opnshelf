import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client";
import type { PrismaService } from "../prisma/prisma.service";
import type { MoviesService } from "../movies/movies.service";
import type { ShowsService } from "../shows/shows.service";
import { privacyPdsFixture } from "../../test/privacy-pds";
import { privacyRepositoryConfig } from "./privacy-category";
import { WatchAccountLock, WatchAccountBusyError } from "./watch-account-lock";
import { WatchPrivacyCoordinator } from "./watch-privacy-coordinator";
import { WatchPrivacyService } from "./watch-privacy.service";
import { ContentPrivacyCoordinator } from "./content-privacy-coordinator";
import { ContentPrivacyProjection } from "./content-privacy-projection";
import { ContentPrivacyService } from "./content-privacy.service";

const url = process.env.WATCH_PRIVACY_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
	throw new Error("Use disposable local PostgreSQL");

function gate() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

describe.skipIf(!url)("background privacy contention", () => {
	let db: PrismaClient;
	let pool: Pool;
	let locks: WatchAccountLock;
	let watches: WatchPrivacyCoordinator;
	let did: string;
	beforeAll(() => {
		db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
		pool = new Pool({
			connectionString: url,
			max: 2,
			query_timeout: 200,
			connectionTimeoutMillis: 1000,
		});
		locks = new WatchAccountLock(pool);
		watches = new WatchPrivacyCoordinator(db as PrismaService, locks);
	});
	beforeEach(async () => {
		did = `did:plc:background-${crypto.randomUUID()}`;
		await db.user.create({
			data: { did, handle: `${crypto.randomUUID()}.test` },
		});
	});
	afterEach(async () => {
		await db.user.delete({ where: { did } });
	});
	afterAll(async () => {
		await db.$disconnect();
		await pool.end();
	});

	it.each(["sync", "runMigration"] as const)(
		"allows a Watch during slow content %s without admitting another content operation or account deletion",
		async (operation) => {
			const pds = privacyPdsFixture(did, privacyRepositoryConfig("notes"));
			const entered = gate(),
				release = gate();
			const restore = vi.fn().mockImplementation(async () => {
				entered.resolve();
				await release.promise;
				return pds.session;
			});
			const coordinator = new ContentPrivacyCoordinator(
				db as PrismaService,
				locks,
			);
			const privacy = new ContentPrivacyService(
				db as PrismaService,
				coordinator,
				locks,
				{
					index: vi.fn(),
					reconcile: vi.fn(),
				} as unknown as ContentPrivacyProjection,
				{ restore },
			);
			const state = await db.privacyScope.create({
				data: {
					userDid: did,
					key: "notes",
					category: "notes",
					managed: true,
					...(operation === "runMigration"
						? {
								migrationId: "migration",
								targetVisibility: "private",
								status: "queued",
							}
						: {}),
				},
			});
			const background = privacy[operation](state.id);
			await entered.promise;
			try {
				await expect(watches.write(did, async () => "saved")).resolves.toBe(
					"saved",
				);
				await expect(privacy.sync(state.id)).rejects.toThrow("in progress");
				await expect(
					watches.deleteLocalAccount(did, async () => {}),
				).rejects.toThrow("in progress");
			} finally {
				release.resolve();
				await background;
			}
		},
	);

	it.each(["unchanged", "created", "updated", "deleted"] as const)(
		"allows a Watch during a slow Watch snapshot and rejects stale reconciliation (change=%s)",
		async (change) => {
			const pds = privacyPdsFixture(did, privacyRepositoryConfig("watches"));
			await db.show.upsert({
				where: { showId: "background-test" },
				create: { showId: "background-test", title: "Background test" },
				update: {},
			});
			if (change === "updated" || change === "deleted") {
				const value = {
					$type: "xyz.opnshelf.episode",
					showId: "background-test",
					seasonNumber: 1,
					episodeNumber: 1,
					source: "tmdb",
					createdAt: "2026-01-01T00:00:00.000Z",
				};
				pds.seed("xyz.opnshelf.episode", "new", value);
				await db.trackedEpisode.create({
					data: {
						userDid: did,
						showId: "background-test",
						rkey: "new",
						uri: `at://${did}/xyz.opnshelf.episode/new`,
						cid: "old",
						seasonNumber: 1,
						episodeNumber: 1,
					},
				});
			}
			const entered = gate(),
				release = gate();
			const fetch = pds.session.fetchHandler;
			vi.spyOn(pds.session, "fetchHandler").mockImplementationOnce(
				async (...args) => {
					const response = await fetch(...args);
					entered.resolve();
					await release.promise;
					return response;
				},
			);
			const privacy = new WatchPrivacyService(
				db as PrismaService,
				watches,
				{ restore: vi.fn() },
				{} as MoviesService,
				{} as ShowsService,
			);
			const background = privacy.sync(did, pds.session);
			// Attach rejection before the concurrent write is exercised.
			const result = background.then(
				() => null,
				(error: unknown) => error,
			);
			await entered.promise;
			try {
				await expect(
					watches.write(did, async () => {
						if (change === "created")
							await db.trackedEpisode.create({
								data: {
									user: { connect: { did } },
									rkey: "new",
									uri: `at://${did}/xyz.opnshelf.episode/new`,
									cid: "new",
									show: {
										connectOrCreate: {
											where: { showId: "background-test" },
											create: {
												showId: "background-test",
												title: "Background test",
											},
										},
									},
									seasonNumber: 1,
									episodeNumber: 1,
								},
							});
						if (change === "updated")
							await db.trackedEpisode.update({
								where: { userDid_rkey: { userDid: did, rkey: "new" } },
								data: { cid: "edited" },
							});
						if (change === "deleted")
							await db.trackedEpisode.delete({
								where: { userDid_rkey: { userDid: did, rkey: "new" } },
							});
						return "saved";
					}),
				).resolves.toBe("saved");
				await expect(watches.start(did, "private", false)).rejects.toThrow(
					"in progress",
				);
			} finally {
				release.resolve();
				await result;
			}
			if (change !== "unchanged") {
				expect(await result).toBeInstanceOf(WatchAccountBusyError);
				if (change === "updated")
					expect(
						(
							await db.trackedEpisode.findUniqueOrThrow({
								where: { userDid_rkey: { userDid: did, rkey: "new" } },
							})
						).cid,
					).toBe("edited");
				expect(await db.trackedEpisode.count({ where: { userDid: did } })).toBe(
					change === "deleted" ? 0 : 1,
				);
				expect(
					(await db.user.findUniqueOrThrow({ where: { did } })).watchSyncedAt,
				).toBeNull();
			} else expect(await result).toBeInstanceOf(WatchAccountBusyError);
		},
	);
	it.each(["movie", "episode"] as const)(
		"keeps slow %s catalogue requests outside the Watch mutex",
		async (kind) => {
			const pds = privacyPdsFixture(did, privacyRepositoryConfig("watches"));
			const entered = gate(),
				release = gate();
			const id = kind === "movie" ? "736001" : "736002";
			await (kind === "movie"
				? db.movie.deleteMany({ where: { movieId: id } })
				: db.show.deleteMany({ where: { showId: id } }));
			const details = vi.fn().mockImplementation(async () => {
				entered.resolve();
				await release.promise;
				return { id: Number(id) };
			});
			pds.seed(`xyz.opnshelf.${kind}`, "remote", {
				$type: `xyz.opnshelf.${kind}`,
				source: "tmdb",
				createdAt: "2026-01-01T00:00:00.000Z",
				...(kind === "movie"
					? { movieId: id }
					: { showId: id, seasonNumber: 1, episodeNumber: 1 }),
			});
			const privacy = new WatchPrivacyService(
				db as PrismaService,
				watches,
				{ restore: vi.fn() },
				{
					getMovieDetails: details,
					upsertMovie: vi.fn(() =>
						db.movie.create({ data: { movieId: id, title: "Remote movie" } }),
					),
				} as unknown as MoviesService,
				{
					getShowDetails: details,
					upsertShow: vi.fn(() =>
						db.show.create({ data: { showId: id, title: "Remote Show" } }),
					),
				} as unknown as ShowsService,
			);
			const background = privacy.sync(did, pds.session).then(
				() => null,
				(error: unknown) => error,
			);
			await entered.promise;
			try {
				await expect(watches.write(did, async () => "saved")).resolves.toBe(
					"saved",
				);
			} finally {
				release.resolve();
				await background;
			}
			expect(await background).toBeInstanceOf(WatchAccountBusyError);
			await privacy.sync(did, pds.session);
			expect(
				await (kind === "movie"
					? db.trackedMovie.count({ where: { userDid: did } })
					: db.trackedEpisode.count({ where: { userDid: did } })),
			).toBe(1);
		},
	);
	it("reserves foreground capacity when manual sync overlaps a background read", async () => {
		const entered = gate(),
			release = gate();
		const background = watches.readThenWrite(did, async () => {
			entered.resolve();
			await release.promise;
		});
		await entered.promise;
		try {
			await expect(
				watches.readThenWrite(did, async () => "admitted"),
			).rejects.toBeInstanceOf(WatchAccountBusyError);
			await expect(watches.write(did, async () => "saved")).resolves.toBe(
				"saved",
			);
			expect(pool.totalCount).toBe(2);
		} finally {
			release.resolve();
			await background;
		}
	});

	it("does not resurrect a Watch created and deleted during a remote snapshot", async () => {
		const pds = privacyPdsFixture(did, privacyRepositoryConfig("watches"));
		const entered = gate(),
			created = gate(),
			captured = gate(),
			release = gate();
		const fetch = pds.session.fetchHandler;
		vi.spyOn(pds.session, "fetchHandler").mockImplementationOnce(
			async (...args) => {
				entered.resolve();
				await created.promise;
				const response = await fetch(...args);
				captured.resolve();
				await release.promise;
				return response;
			},
		);
		const movieId = "736-aba";
		await db.movie.upsert({
			where: { movieId },
			create: { movieId, title: "ABA fixture" },
			update: {},
		});
		const privacy = new WatchPrivacyService(
			db as PrismaService,
			watches,
			{ restore: vi.fn() },
			{} as MoviesService,
			{} as ShowsService,
		);
		const result = privacy.sync(did, pds.session).then(
			() => null,
			(error: unknown) => error,
		);
		await entered.promise;
		try {
			await watches.write(did, async () => {
				pds.seed("xyz.opnshelf.movie", "temporary", {
					$type: "xyz.opnshelf.movie",
					movieId,
					source: "tmdb",
					createdAt: "2026-01-01T00:00:00.000Z",
				});
				await db.trackedMovie.create({
					data: {
						userDid: did,
						movieId,
						rkey: "temporary",
						uri: `at://${did}/xyz.opnshelf.movie/temporary`,
						cid: "temporary",
					},
				});
			});
			created.resolve();
			await captured.promise;
			await watches.write(did, async () => {
				pds.publicRecords.clear();
				await db.trackedMovie.deleteMany({ where: { userDid: did } });
			});
		} finally {
			created.resolve();
			release.resolve();
			await result;
		}
		expect(await result).toBeInstanceOf(WatchAccountBusyError);
		expect(await db.trackedMovie.count({ where: { userDid: did } })).toBe(0);
	});
	it("completes a sync when no other Watch mutex acquisition intervenes", async () => {
		const pds = privacyPdsFixture(did, privacyRepositoryConfig("watches"));
		const privacy = new WatchPrivacyService(
			db as PrismaService,
			watches,
			{ restore: vi.fn() },
			{} as MoviesService,
			{} as ShowsService,
		);
		await privacy.sync(did, pds.session);
		expect(
			(await db.user.findUniqueOrThrow({ where: { did } })).watchSyncedAt,
		).not.toBeNull();
	});
});
