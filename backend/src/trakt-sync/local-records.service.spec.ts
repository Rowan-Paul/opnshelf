import { beforeEach, describe, expect, it, vi } from "vitest";
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
