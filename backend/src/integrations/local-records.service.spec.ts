import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalSyncLists } from "./local-lists.service";
import { LocalSyncRecords } from "./local-records.service";
import type { SyncRecord } from "./reconcile";
import type { PrismaService } from "../prisma/prisma.service";
import type { MoviesService } from "../movies/movies.service";
import type { ShowsService } from "../shows/shows.service";
import type { RatingsService } from "../ratings/ratings.service";
import type { AuthService } from "../auth/auth.service";

const repo = vi.hoisted(() => ({
	getRecord: vi.fn(),
	putRecord: vi.fn(),
	deleteRecord: vi.fn(),
}));
vi.mock("@atproto/api", () => ({
	Agent: class {
		com = { atproto: { repo } };
	},
}));
const index = vi.fn();
const local = new LocalSyncRecords(
	{ trackedMovie: { deleteMany: vi.fn() } } as unknown as PrismaService,
	{
		indexTrackedMovie: index,
		buildMovieWatchRecord: vi.fn(() => ({
			record: { movieId: "12", createdAt: "2000-01-01T00:00:00Z" },
		})),
	} as unknown as MoviesService,
	{} as ShowsService,
	{} as RatingsService,
	{ restore: vi.fn(async () => ({})) } as unknown as Pick<
		AuthService,
		"restore"
	>,
	{} as LocalSyncLists,
	{} as unknown as import("./local-content.service").LocalSyncContent,
);
const record: SyncRecord = {
	key: "movie:original",
	rkey: "original",
	cid: "old-cid",
	kind: "watch",
	mediaType: "movie",
	mediaId: "12",
	season: 0,
	episode: 0,
	title: "Fixture",
	value: "2020-01-01T00:00:00Z",
};
describe("Trakt PDS write recovery", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		repo.putRecord.mockResolvedValue({
			data: { uri: "at://fixture/xyz.opnshelf.movie/original", cid: "new-cid" },
		});
	});
	it("updates the original rkey using compare-and-swap and preserves extension fields", async () => {
		repo.getRecord.mockResolvedValue({
			data: {
				cid: "old-cid",
				value: {
					watchedAt: record.value,
					createdAt: "2000-01-01T00:00:00Z",
					custom: "keep",
				},
			},
		});
		await local.write(
			"fixture",
			"connection",
			{ ...record, value: null },
			record,
		);
		expect(repo.putRecord).toHaveBeenCalledWith(
			expect.objectContaining({
				rkey: "original",
				swapRecord: "old-cid",
				record: {
					movieId: "12",
					createdAt: "2000-01-01T00:00:00Z",
					custom: "keep",
				},
			}),
		);
	});
	it("does not overwrite a PDS change newer than the indexed snapshot", async () => {
		repo.getRecord.mockResolvedValue({
			data: { cid: "concurrent", value: { watchedAt: "2021-01-01T00:00:00Z" } },
		});
		await expect(
			local.write("fixture", "connection", { ...record, value: null }, record),
		).rejects.toThrow("changed while");
		expect(repo.putRecord).not.toHaveBeenCalled();
	});
	it("reindexes an acknowledged-late write without issuing it again", async () => {
		repo.getRecord.mockResolvedValue({
			data: {
				cid: "already-written",
				value: { movieId: "12", watchedAt: record.value },
			},
		});
		await local.write("fixture", "connection", record, null, "original");
		expect(repo.putRecord).not.toHaveBeenCalled();
		expect(index).toHaveBeenCalled();
	});
	it("restores a deleted linked Watch using its reserved identity", async () => {
		repo.getRecord.mockRejectedValue({ error: "RecordNotFound" });
		await local.write("fixture", "connection", record, null, "original");
		expect(repo.putRecord).toHaveBeenCalledWith(
			expect.objectContaining({ rkey: "original", swapRecord: null }),
		);
	});
	it("never treats a PDS timeout as proof of deletion", async () => {
		repo.getRecord.mockRejectedValue(new Error("timeout"));
		await expect(local.confirmDeleted("fixture", record)).rejects.toThrow(
			"timeout",
		);
	});
});

it("looks up Rating titles without repeatedly scanning the media catalog", async () => {
	let reads = 0;
	const movies = Array.from({ length: 100 }, (_, i) => ({
		get movieId() {
			reads++;
			return String(i);
		},
		title: `Movie ${i}`,
	}));
	const ratings = movies.map((_, i) => ({
		rkey: String(i),
		mediaType: "movie",
		mediaId: String(i),
		seasonNumber: 0,
		episodeNumber: 0,
		rating: 8,
	}));
	const snapshot = new LocalSyncRecords(
		{
			$transaction: async (queries: unknown[]) => Promise.all(queries),
			trackedMovie: { findMany: async () => [] },
			trackedEpisode: { findMany: async () => [] },
			rating: { findMany: async () => ratings },
			movie: { findMany: async () => movies },
			show: { findMany: async () => [] },
		} as unknown as PrismaService,
		{} as MoviesService,
		{} as ShowsService,
		{} as RatingsService,
		{} as Pick<AuthService, "restore">,
		{} as LocalSyncLists,
		{} as unknown as import("./local-content.service").LocalSyncContent,
	);
	const result = await snapshot.snapshot("fixture");
	expect(result.map((r) => r.title)).toEqual(movies.map((m) => m.title));
	expect(reads).toBeLessThanOrEqual(movies.length);
});

it.each(["watch", "rating", "note"] as const)(
	"does not load unrelated indexed history for a %s issue page",
	async (kind) => {
		const watchedMovies = vi.fn(async () => [
			{
				rkey: "one",
				movieId: "12",
				movie: { title: "Fixture" },
				watchedDate: null,
			},
		]);
		const watchedEpisodes = vi.fn(async () => []);
		const ratings = vi.fn(async () => [
			{
				rkey: "one",
				mediaType: "movie",
				mediaId: "12",
				rating: 8,
				seasonNumber: 0,
				episodeNumber: 0,
			},
		]);
		const titles = vi.fn(async () => [{ movieId: "12", title: "Fixture" }]);
		const content = vi.fn(async () => [
			{ ...record, key: "note:one", kind: "note" as const },
		]);
		const snapshot = new LocalSyncRecords(
			{
				$transaction: async (queries: unknown[]) => Promise.all(queries),
				trackedMovie: { findMany: watchedMovies },
				trackedEpisode: { findMany: watchedEpisodes },
				rating: { findMany: ratings },
				movie: { findMany: titles },
				show: { findMany: vi.fn(async () => []) },
			} as unknown as PrismaService,
			{} as MoviesService,
			{} as ShowsService,
			{} as RatingsService,
			{} as Pick<AuthService, "restore">,
			{} as LocalSyncLists,
			{
				snapshot: content,
			} as unknown as import("./local-content.service").LocalSyncContent,
		);
		const result = await snapshot.snapshot(
			"fixture",
			{ notes: kind === "note" },
			new Set([kind]),
		);
		expect(result.map((r) => r.kind)).toEqual([kind]);
		expect(watchedMovies).toHaveBeenCalledTimes(kind === "watch" ? 1 : 0);
		expect(watchedEpisodes).toHaveBeenCalledTimes(kind === "watch" ? 1 : 0);
		expect(ratings).toHaveBeenCalledTimes(kind === "rating" ? 1 : 0);
		expect(titles).toHaveBeenCalledTimes(kind === "rating" ? 1 : 0);
	},
);
