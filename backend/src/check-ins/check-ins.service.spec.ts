import { describe, expect, it, vi } from "vitest";
import type { AuthService } from "../auth/auth.service";
import type { MoviesService } from "../movies/movies.service";
import type { WatchPrivacyCoordinator } from "../privacy/watch-privacy-coordinator";
import type { PrismaService } from "../prisma/prisma.service";
import type { ShowsService } from "../shows/shows.service";
import { CheckInsService } from "./check-ins.service";

const repo = vi.hoisted(() => ({ getRecord: vi.fn(), putRecord: vi.fn() }));
vi.mock("../privacy/watch-operation", async (importOriginal) => ({
	...(await importOriginal<typeof import("../privacy/watch-operation")>()),
	createWatchAgent: () => ({ com: { atproto: { repo } } }),
}));

function fixture() {
	const userDid = "did:plc:watcher";
	const startedAt = new Date("2026-11-23T20:00:00.000Z");
	const row = {
		userDid,
		rkey: "check-in-key",
		mediaId: "42",
		title: "Fixture film",
		seasonNumber: null,
		episodeNumber: null,
		startedAt,
		endsAt: null,
		finishingAt: null,
		retryAfter: null,
		user: { handle: "watcher.test" },
	};
	const table = {
		findUnique: vi.fn().mockResolvedValue(row),
		findMany: vi.fn().mockResolvedValue([row]),
		update: vi.fn().mockResolvedValue(row),
		upsert: vi.fn().mockResolvedValue(row),
		deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
		updateMany: vi.fn().mockResolvedValue({ count: 1 }),
	};
	const movies = {
		getMovieDetails: vi
			.fn()
			.mockResolvedValue({ title: row.title, runtime: 30 }),
		buildMovieWatchRecord: vi
			.fn()
			.mockReturnValue({ collection: "xyz.opnshelf.movie", record: {} }),
		indexTrackedMovie: vi.fn().mockResolvedValue({}),
	};
	const coordinator = {
		write: <T>(
			_: string,
			run: (visibility: "public", signal: AbortSignal) => Promise<T>,
		) => run("public", new AbortController().signal),
	};
	const service = new CheckInsService(
		{ watchingCheckIn: table } as unknown as PrismaService,
		movies as unknown as MoviesService,
		{} as ShowsService,
		{
			restore: vi.fn().mockResolvedValue({ did: userDid }),
		} as unknown as AuthService,
		coordinator as unknown as WatchPrivacyCoordinator,
	);
	return { service, table, movies, row, userDid };
}

describe("Watching Check-ins", () => {
	it("requires confirmation for the current check-in and replaces it without a Watch write", async () => {
		const { service, table, row, userDid } = fixture();
		repo.putRecord.mockClear();
		await expect(
			service.start(userDid, { mediaId: "1", replaceId: "stale" }),
		).rejects.toThrow("Your check-in has changed");
		expect(table.upsert).not.toHaveBeenCalled();
		await service.start(userDid, { mediaId: "1", replaceId: row.rkey });
		expect(table.upsert).toHaveBeenCalledOnce();
		expect(repo.putRecord).not.toHaveBeenCalled();
	});

	it("cancels only a still-active check-in and creates no Watch", async () => {
		const { service, table, row, userDid } = fixture();
		repo.putRecord.mockClear();
		await service.cancel(userDid, row.rkey);
		expect(table.deleteMany).toHaveBeenCalledWith({
			where: {
				userDid,
				rkey: row.rkey,
				finishingAt: null,
				OR: [{ endsAt: null }, { endsAt: { gt: expect.any(Date) } }],
			},
		});
		expect(repo.putRecord).not.toHaveBeenCalled();
	});

	it("recovers an accepted PDS write after indexing fails without duplicating it", async () => {
		const { service, table, movies, row, userDid } = fixture();
		repo.putRecord
			.mockReset()
			.mockResolvedValue({ data: { uri: "at://watch", cid: "cid" } });
		repo.getRecord
			.mockReset()
			.mockRejectedValueOnce({ error: "RecordNotFound" })
			.mockResolvedValueOnce({ data: { uri: "at://watch", cid: "cid" } });
		movies.indexTrackedMovie.mockRejectedValueOnce(
			new Error("Index unavailable"),
		);
		await expect(
			service.finish(userDid, row.rkey, { did: userDid }),
		).rejects.toThrow("Index unavailable");
		expect(table.deleteMany).not.toHaveBeenCalled();
		await expect(
			service.finish(userDid, row.rkey, { did: userDid }),
		).resolves.toMatchObject({ items: expect.any(Array) });
		expect(repo.putRecord).toHaveBeenCalledOnce();
		expect(movies.buildMovieWatchRecord).toHaveBeenLastCalledWith(
			row.mediaId,
			row.startedAt.toISOString(),
			row.rkey,
		);
		expect(movies.indexTrackedMovie).toHaveBeenLastCalledWith(
			"at://watch",
			"cid",
			row.rkey,
			userDid,
			row.mediaId,
			row.startedAt.toISOString(),
			true,
		);
		expect(table.deleteMany).toHaveBeenCalledOnce();
	});

	it("logs a due check-in from the background without a client request", async () => {
		vi.useFakeTimers();
		const { service, table, row, userDid } = fixture();
		const endsAt = new Date(Date.now() + 1_000);
		table.findMany.mockResolvedValue([{ userDid, rkey: row.rkey }]);
		table.findUnique.mockResolvedValue({ ...row, endsAt });
		repo.getRecord.mockReset().mockRejectedValue({ error: "RecordNotFound" });
		repo.putRecord
			.mockReset()
			.mockResolvedValue({ data: { uri: "at://watch", cid: "cid" } });
		service.onModuleInit();
		try {
			await vi.advanceTimersByTimeAsync(10_000);
			expect(table.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {
						AND: [
							{
								OR: [
									{ endsAt: { lte: expect.any(Date) } },
									{ finishingAt: { not: null } },
								],
							},
							{
								OR: [
									{ retryAfter: null },
									{ retryAfter: { lte: expect.any(Date) } },
								],
							},
						],
					},
				}),
			);
			expect(table.findUnique).toHaveBeenCalledExactlyOnceWith({
				where: { userDid, rkey: row.rkey },
			});
			expect(repo.putRecord).toHaveBeenCalledOnce();
			expect(table.deleteMany).toHaveBeenCalledWith({
				where: { userDid, rkey: row.rkey },
			});
		} finally {
			service.onModuleDestroy();
			vi.useRealTimers();
		}
	});

	it("backs off a check-in that fails before it is claimed and still logs the next one", async () => {
		vi.useFakeTimers();
		const { service, table, row, userDid } = fixture();
		const endsAt = new Date(Date.now() - 1_000);
		table.findMany.mockResolvedValue([
			{ userDid: "did:plc:contended", rkey: "contended-key" },
			{ userDid, rkey: row.rkey },
		]);
		table.findUnique
			.mockRejectedValueOnce(new Error("Lock unavailable"))
			.mockResolvedValue({ ...row, endsAt });
		repo.getRecord.mockReset().mockRejectedValue({ error: "RecordNotFound" });
		repo.putRecord
			.mockReset()
			.mockResolvedValue({ data: { uri: "at://watch", cid: "cid" } });
		service.onModuleInit();
		try {
			const tick = Date.now() + 10_000;
			await vi.advanceTimersByTimeAsync(10_000);
			expect(table.updateMany).toHaveBeenCalledOnce();
			expect(table.updateMany).toHaveBeenCalledWith({
				where: {
					userDid: "did:plc:contended",
					rkey: "contended-key",
					OR: [{ retryAfter: null }, { retryAfter: { lte: new Date(tick) } }],
				},
				data: { retryAfter: new Date(tick + 60_000) },
			});
			expect(repo.putRecord).toHaveBeenCalledOnce();
			expect(table.deleteMany).toHaveBeenCalledWith({
				where: { userDid, rkey: row.rkey },
			});
		} finally {
			service.onModuleDestroy();
			vi.useRealTimers();
		}
	});

	it("leaves a backed-off check-in alone until its retry time", async () => {
		vi.useFakeTimers();
		const { service, table, row, userDid } = fixture();
		const retryAfter = new Date(Date.now() + 60_000);
		table.findMany.mockResolvedValue([{ userDid, rkey: row.rkey }]);
		table.findUnique.mockResolvedValue({
			...row,
			endsAt: new Date(Date.now() - 1_000),
			retryAfter,
		});
		repo.getRecord.mockReset().mockRejectedValue({ error: "RecordNotFound" });
		repo.putRecord
			.mockReset()
			.mockResolvedValue({ data: { uri: "at://watch", cid: "cid" } });
		service.onModuleInit();
		try {
			await vi.advanceTimersByTimeAsync(50_000);
			expect(table.update).not.toHaveBeenCalled();
			expect(repo.putRecord).not.toHaveBeenCalled();
			await vi.advanceTimersByTimeAsync(10_000);
			expect(repo.putRecord).toHaveBeenCalledOnce();
			expect(table.deleteMany).toHaveBeenCalledWith({
				where: { userDid, rkey: row.rkey },
			});
		} finally {
			service.onModuleDestroy();
			vi.useRealTimers();
		}
	});

	it("filters public projections by Shelf privacy and expiry at the database boundary", async () => {
		const { service, table, userDid } = fixture();
		await service.visible({ did: userDid });
		expect(table.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					user: {
						did: userDid,
						watchVisibility: "public",
						watchPrivacyMigration: { is: null },
					},
					finishingAt: null,
					OR: [{ endsAt: null }, { endsAt: { gt: expect.any(Date) } }],
				},
			}),
		);
	});
});
