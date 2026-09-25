import { mockEnvironment } from "../../test/env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationWorkerService } from "./notification-worker.service";

describe("NotificationWorkerService", () => {
	const user = {
		timezone: "Europe/Amsterdam",
		watchCountry: "NL",
		handle: "alice.test",
	};
	const settings = {
		userDid: "did:plc:alice",
		nextQueueAt: new Date("2026-09-28T07:00:00.000Z"),
		user,
		email: "alice@example.com",
		emailVerifiedAt: new Date(),
		emailNewReleases: true,
		emailWatchlistReleases: false,
		emailNewSeasons: false,
		emailStats: false,
		pushNewReleases: false,
		pushWatchlistReleases: false,
		pushNewSeasons: false,
		pushStats: false,
	};
	const prisma = {
		notificationCollection: { upsert: vi.fn() },
		notificationSettings: { findMany: vi.fn(), updateMany: vi.fn() },
		pushDevice: { findMany: vi.fn() },
		notificationDelivery: {
			upsert: vi.fn(),
			findMany: vi.fn(),
			updateMany: vi.fn(),
			update: vi.fn(),
		},
		listItem: { findMany: vi.fn() },
		season: { findMany: vi.fn() },
		trackedMovie: { count: vi.fn().mockResolvedValue(2) },
		trackedEpisode: { findMany: vi.fn(), count: vi.fn().mockResolvedValue(3) },
	};
	const email = { sendNotification: vi.fn() };
	const config = mockEnvironment({ get: vi.fn() });
	const movies = { discoverReleasesBetween: vi.fn() };
	const shows = { discoverPremieresBetween: vi.fn() };
	const worker = new NotificationWorkerService(
		prisma as never,
		email as never,
		config as never,
		movies as never,
		shows as never,
	);

	beforeEach(() => {
		vi.clearAllMocks();
		prisma.notificationCollection.upsert.mockImplementation(({ create }) =>
			Promise.resolve({ id: "collection-1", ...create }),
		);
		prisma.trackedMovie.count.mockResolvedValue(2);
		prisma.trackedEpisode.count.mockResolvedValue(3);
		prisma.notificationSettings.findMany.mockResolvedValue([settings]);
		prisma.notificationSettings.updateMany.mockResolvedValue({ count: 1 });
		prisma.pushDevice.findMany.mockResolvedValue([]);
		prisma.notificationDelivery.upsert.mockResolvedValue({});
		prisma.notificationDelivery.findMany.mockResolvedValue([]);
		prisma.notificationDelivery.updateMany.mockResolvedValue({ count: 1 });
		prisma.notificationDelivery.update.mockResolvedValue({});
		email.sendNotification.mockResolvedValue(undefined);
		config.get.mockReturnValue("https://staging.opnshelf.xyz");
		prisma.listItem.findMany.mockResolvedValue([]);
		movies.discoverReleasesBetween.mockResolvedValue([
			{ id: 42, title: "A Movie" },
		]);
		shows.discoverPremieresBetween.mockResolvedValue([
			{ id: 24, name: "A Show" },
		]);
	});

	describe("startup with a schedule saved by an older deployment", () => {
		let nextQueueAt: Date;
		const queuedEvents = new Set<string>();
		const startedWorkers: NotificationWorkerService[] = [];

		beforeEach(() => {
			vi.useFakeTimers();
			nextQueueAt = new Date("2026-09-26T07:00:00.000Z");
			queuedEvents.clear();
			// Unlike the normal fixtures, honor the persisted due-time filter.
			prisma.notificationSettings.findMany.mockImplementation(({ where }) =>
				Promise.resolve(
					nextQueueAt <= where.nextQueueAt.lte
						? [{ ...settings, nextQueueAt }]
						: [],
				),
			);
			prisma.notificationSettings.updateMany.mockImplementation(
				({ where, data }) => {
					const matches =
						where.nextQueueAt instanceof Date
							? nextQueueAt.getTime() === where.nextQueueAt.getTime()
							: nextQueueAt > where.nextQueueAt.gt;
					if (matches) nextQueueAt = data.nextQueueAt;
					return Promise.resolve({ count: Number(matches) });
				},
			);
			prisma.notificationDelivery.upsert.mockImplementation(
				({ create, update }) => {
					// A repeated event must preserve the existing delivery.
					expect(update).toEqual({});
					queuedEvents.add(create.eventKey);
					return Promise.resolve({});
				},
			);
		});

		afterEach(() => {
			for (const instance of startedWorkers) instance.onModuleDestroy();
			startedWorkers.length = 0;
			vi.useRealTimers();
			vi.resetAllMocks();
		});

		async function startWorker(now: string) {
			vi.setSystemTime(new Date(now));
			const instance = new NotificationWorkerService(
				{
					...prisma,
					movie: { findMany: vi.fn().mockResolvedValue([]) },
					show: { findMany: vi.fn().mockResolvedValue([]) },
				} as never,
				email as never,
				config as never,
				movies as never,
				shows as never,
			);
			startedWorkers.push(instance);
			instance.onModuleInit();
			await vi.advanceTimersByTimeAsync(0);
			return instance;
		}

		it("replaces Saturday's cached check and queues Friday's digest at 18:00", async () => {
			await startWorker("2026-09-25T13:57:00.000Z");
			expect(queuedEvents.size).toBe(0);
			expect(nextQueueAt).toEqual(new Date("2026-09-25T16:00:00.000Z"));
			await vi.advanceTimersByTimeAsync(125 * 60_000);
			expect([...queuedEvents]).toEqual(["new-releases:2026-09-21:NL"]);
			expect(nextQueueAt).toEqual(new Date("2026-09-26T07:00:00.000Z"));
		});

		it("recovers on a Friday evening restart without replacing an existing event", async () => {
			const first = await startWorker("2026-09-25T18:00:00.000Z");
			expect([...queuedEvents]).toEqual(["new-releases:2026-09-21:NL"]);
			first.onModuleDestroy();
			await startWorker("2026-09-25T18:01:00.000Z");
			expect(prisma.notificationDelivery.upsert).toHaveBeenCalledTimes(2);
			expect(queuedEvents.size).toBe(1);
			await vi.advanceTimersByTimeAsync(5 * 60_000);
			expect(prisma.notificationDelivery.upsert).toHaveBeenCalledTimes(2);
		});

		it("retries startup reconciliation after a transient database failure", async () => {
			prisma.notificationSettings.updateMany.mockRejectedValueOnce(
				new Error("database unavailable"),
			);
			await startWorker("2026-09-25T18:00:00.000Z");
			expect(queuedEvents.size).toBe(0);
			await vi.advanceTimersByTimeAsync(5 * 60_000);
			expect([...queuedEvents]).toEqual(["new-releases:2026-09-21:NL"]);
		});
	});

	it("queues the Monday–Sunday release digest on Friday at 18:00 local time", async () => {
		await worker.queueDueEvents(new Date("2026-10-02T16:00:00.000Z"));
		expect(movies.discoverReleasesBetween).toHaveBeenCalledWith(
			"2026-09-28",
			"2026-10-04",
			"NL",
		);
		expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: expect.objectContaining({
					channel: "email",
					eventKey: "new-releases:2026-09-28:NL",
					body: "A Movie and A Show. Take a look.",
					url: "/discover/collections/collection-1",
				}),
			}),
		);
		expect(prisma.notificationSettings.updateMany).toHaveBeenCalledWith({
			where: { userDid: settings.userDid, nextQueueAt: settings.nextQueueAt },
			data: { nextQueueAt: new Date("2026-10-03T07:00:00.000Z") },
		});
	});

	it.each([
		["2026-10-02T06:00:00.000Z", "2026-10-02T07:00:00.000Z"],
		["2026-10-02T07:00:00.000Z", "2026-10-02T16:00:00.000Z"],
		["2026-10-02T15:59:00.000Z", "2026-10-02T16:00:00.000Z"],
		["2026-10-30T08:00:00.000Z", "2026-10-30T17:00:00.000Z"],
	])(
		"waits for Friday evening while preserving the morning run at %s",
		async (now, next) => {
			await worker.queueDueEvents(new Date(now));
			expect(movies.discoverReleasesBetween).not.toHaveBeenCalled();
			expect(prisma.notificationSettings.updateMany).toHaveBeenCalledWith(
				expect.objectContaining({ data: { nextQueueAt: new Date(next) } }),
			);
		},
	);

	it("keeps weekly stats on Monday morning without a release digest", async () => {
		prisma.notificationSettings.findMany.mockResolvedValue([
			{ ...settings, emailStats: true },
		]);
		await worker.queueDueEvents(new Date("2026-09-28T07:00:00.000Z"));
		expect(movies.discoverReleasesBetween).not.toHaveBeenCalled();
		expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: expect.objectContaining({
					category: "Stats",
					eventKey: "stats:weekly:2026-09-28",
				}),
			}),
		);
		expect(prisma.trackedMovie.count).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					watchedDate: {
						gte: new Date("2026-09-20T22:00:00.000Z"),
						lt: new Date("2026-09-27T22:00:00.000Z"),
					},
				}),
			}),
		);
	});

	it("uses the user's Friday even when UTC is already Saturday", async () => {
		prisma.notificationSettings.findMany.mockResolvedValue([
			{ ...settings, user: { ...user, timezone: "America/Los_Angeles" } },
		]);
		await worker.queueDueEvents(new Date("2026-10-03T01:00:00.000Z"));
		expect(movies.discoverReleasesBetween).toHaveBeenCalledWith(
			"2026-09-28",
			"2026-10-04",
			"NL",
		);
		expect(prisma.notificationSettings.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: { nextQueueAt: new Date("2026-10-03T16:00:00.000Z") },
			}),
		);
	});

	it("keeps monthly and yearly stats on January 1 at 09:00, even on Friday", async () => {
		prisma.notificationSettings.findMany.mockResolvedValue([
			{ ...settings, emailStats: true },
		]);
		await worker.queueDueEvents(new Date("2027-01-01T08:00:00.000Z"));
		expect(movies.discoverReleasesBetween).not.toHaveBeenCalled();
		for (const period of ["monthly", "yearly"]) {
			expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith(
				expect.objectContaining({
					create: expect.objectContaining({
						eventKey: `stats:${period}:2027-01-01`,
					}),
				}),
			);
		}
	});

	it("queries only accounts due at this tick", async () => {
		prisma.notificationSettings.findMany.mockResolvedValue([]);
		const now = new Date("2026-09-28T08:00:00.000Z");
		await worker.queueDueEvents(now);
		expect(prisma.notificationSettings.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { nextQueueAt: { lte: now } } }),
		);
		expect(prisma.pushDevice.findMany).not.toHaveBeenCalled();
	});

	it("retries an account when event queuing fails", async () => {
		prisma.pushDevice.findMany.mockRejectedValue(
			new Error("database unavailable"),
		);
		await worker.queueDueEvents(new Date("2026-09-28T08:00:00.000Z"));
		expect(prisma.notificationSettings.updateMany).not.toHaveBeenCalled();
	});

	it("does not send the general digest on Tuesday", async () => {
		await worker.queueDueEvents(new Date("2026-09-29T08:00:00.000Z"));
		expect(movies.discoverReleasesBetween).not.toHaveBeenCalled();
		expect(prisma.notificationDelivery.upsert).not.toHaveBeenCalled();
	});

	it("queues a watchlist movie on its release day", async () => {
		prisma.notificationSettings.findMany.mockResolvedValue([
			{
				...settings,
				emailNewReleases: false,
				emailWatchlistReleases: true,
			},
		]);
		prisma.listItem.findMany.mockResolvedValue([
			{
				movie: { movieId: "42", title: "A Movie", posterPath: null },
				show: null,
			},
		]);
		await worker.queueDueEvents(new Date("2026-09-29T08:00:00.000Z"));
		expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				create: expect.objectContaining({
					category: "WatchlistReleases",
					eventKey: "watchlist:2026-09-29",
					body: "A Movie. Take a look.",
				}),
			}),
		);
	});

	it("links notification emails to their settings section", async () => {
		prisma.notificationDelivery.findMany.mockResolvedValue([
			{
				id: "delivery-1",
				userDid: settings.userDid,
				channel: "email",
				category: "NewReleases",
				status: "pending",
				attempts: 0,
				nextAttemptAt: new Date("2026-09-28T08:00:00.000Z"),
				title: "New releases",
				body: "A Movie and A Show. Take a look.",
				url: null,
				user: { notificationSettings: settings },
			},
		]);

		await worker.deliverPending();

		expect(email.sendNotification).toHaveBeenCalledWith(
			expect.objectContaining({
				text: expect.stringContaining(
					"Manage notifications: https://staging.opnshelf.xyz/settings/notifications",
				),
			}),
		);
	});
	it("keeps the saved selection and copy when catalog ordering changes on a retry", async () => {
		let saved: unknown;
		prisma.notificationCollection.upsert.mockImplementation(
			({ create, update }) => {
				expect(update).toEqual({});
				saved ??= { id: "saved", ...create };
				return Promise.resolve(saved);
			},
		);
		await worker.queueDueEvents(new Date("2026-10-02T16:00:00Z"));
		movies.discoverReleasesBetween.mockResolvedValue([
			{ id: 99, title: "Changed catalog" },
		]);
		await worker.queueDueEvents(new Date("2026-10-02T16:05:00Z"));
		expect(
			prisma.notificationDelivery.upsert.mock.calls.at(-1)?.[0].create,
		).toMatchObject({
			body: "A Movie and A Show. Take a look.",
			url: "/discover/collections/saved",
			collectionId: "saved",
		});
	});

	it.each([1, 2])(
		"routes %i Watchlist releases to the matching destination",
		async (count) => {
			prisma.notificationSettings.findMany.mockResolvedValue([
				{ ...settings, emailNewReleases: false, emailWatchlistReleases: true },
			]);
			prisma.listItem.findMany.mockResolvedValue(
				Array.from({ length: count }, (_, i) => ({
					movie: {
						movieId: String(i + 1),
						title: `Movie ${i + 1}`,
						posterPath: null,
						overview: "Story",
					},
					show: null,
				})),
			);
			await worker.queueDueEvents(new Date("2026-09-29T07:00:00Z"));
			expect(
				prisma.notificationDelivery.upsert.mock.calls[0][0].create.url,
			).toBe(
				count === 1
					? "/movies/1/movie-1"
					: "/discover/collections/collection-1",
			);
		},
	);
	it("shares one collection across email and every push device", async () => {
		prisma.notificationSettings.findMany.mockResolvedValue([
			{ ...settings, pushNewReleases: true },
		]);
		prisma.pushDevice.findMany.mockResolvedValue([
			{ token: "first" },
			{ token: "second" },
		]);
		await worker.queueDueEvents(new Date("2026-10-02T16:00:00Z"));
		expect(prisma.notificationCollection.upsert).toHaveBeenCalledTimes(1);
		expect(
			prisma.notificationDelivery.upsert.mock.calls.map(([args]) => ({
				channel: args.create.channel,
				url: args.create.url,
			})),
		).toEqual([
			{ channel: "email", url: "/discover/collections/collection-1" },
			{ channel: "push:first", url: "/discover/collections/collection-1" },
			{ channel: "push:second", url: "/discover/collections/collection-1" },
		]);
	});
	it.each([1, 2])(
		"keeps season detail links for %i returning shows",
		async (count) => {
			prisma.notificationSettings.findMany.mockResolvedValue([
				{ ...settings, emailNewReleases: false, emailNewSeasons: true },
			]);
			prisma.trackedEpisode.findMany.mockResolvedValue([{ showId: "24" }]);
			prisma.season.findMany.mockResolvedValue(
				Array.from({ length: count }, (_, i) => ({
					showId: String(24 + i),
					seasonNumber: 2,
					posterPath: null,
					show: { title: `Show ${i + 1}`, posterPath: null, overview: "Story" },
				})),
			);
			await worker.queueDueEvents(new Date("2026-09-29T07:00:00Z"));
			const saved =
				prisma.notificationCollection.upsert.mock.calls[0][0].create;
			expect(saved.items[0].path).toBe("/shows/24/show-1/seasons/2");
			expect(
				prisma.notificationDelivery.upsert.mock.calls[0][0].create.url,
			).toBe(
				count === 1
					? "/shows/24/show-1/seasons/2"
					: "/discover/collections/collection-1",
			);
		},
	);
});
