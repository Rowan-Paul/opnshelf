import { mockWatchCoordinator } from "../../../test/watch-privacy";
import type { MoviesService } from "../../movies/movies.service";
import type { ShowsService } from "../../shows/shows.service";
import type { PrismaService } from "../../prisma/prisma.service";
import { WatchImportWriter } from "./watch-import-writer.service";

vi.mock("../../prisma/prisma.service", () => ({ PrismaService: vi.fn() }));
const { applyWrites, getRecord } = vi.hoisted(() => ({
	applyWrites: vi.fn(),
	getRecord: vi.fn(),
}));
vi.mock("@atproto/api", () => ({
	Agent: vi.fn(() => ({
		com: { atproto: { repo: { applyWrites, getRecord } } },
	})),
}));

const movieIndex = vi.fn();
const episodeIndex = vi.fn();
const findFirst = vi.fn();
const writer = new WatchImportWriter(
	{
		trackedMovie: { findFirst },
		trackedEpisode: { findFirst },
	} as unknown as PrismaService,
	{
		buildMovieWatchRecord: (
			movieId: string,
			watchedAt: string,
			rkey: string,
		) => ({
			rkey,
			collection: "xyz.opnshelf.movie",
			record: { movieId, watchedAt },
		}),
		indexTrackedMovie: movieIndex,
	} as unknown as MoviesService,
	{
		buildEpisodeWatchRecord: (
			showId: string,
			seasonNumber: number,
			episodeNumber: number,
			watchedAt: string,
			rkey: string,
		) => ({
			rkey,
			collection: "xyz.opnshelf.episode",
			record: { showId, seasonNumber, episodeNumber, watchedAt },
		}),
		indexTrackedEpisode: episodeIndex,
	} as unknown as ShowsService,
	{ restore: vi.fn() },
	mockWatchCoordinator(),
);
const session = { did: "did:plc:owner" };
const originalDate = "2020-01-01T00:00:00Z";

beforeEach(() => {
	vi.resetAllMocks();
	findFirst.mockResolvedValue(null);
});

it.each(["2021-02-03T04:05:06Z", undefined])(
	"recovers an edited movie (%s) and a missing episode without overwriting either",
	async (watchedAt) => {
		applyWrites
			.mockRejectedValueOnce(new Error("record already exists"))
			.mockRejectedValueOnce(new Error("record already exists"))
			.mockResolvedValueOnce({
				data: { results: [{ uri: "episode-uri", cid: "new" }] },
			});
		getRecord.mockResolvedValue({
			data: { uri: "movie-uri", cid: "corrected", value: { watchedAt } },
		});
		const result = await writer.importNormalizedItems(session.did, session, [
			{ type: "movie", movieTmdbId: 1, watchedAt: originalDate },
			{
				type: "episode",
				showTmdbId: 2,
				seasonNumber: 1,
				episodeNumber: 1,
				watchedAt: originalDate,
			},
		]);
		expect(result).toEqual({ imported: 2, skipped: 0, failed: 0, errors: [] });
		for (const [request] of applyWrites.mock.calls) {
			expect(
				request.writes.every(
					(write: { $type: string }) =>
						write.$type === "com.atproto.repo.applyWrites#create",
				),
			).toBe(true);
		}
		expect(movieIndex).toHaveBeenCalledWith(
			"movie-uri",
			"corrected",
			expect.any(String),
			session.did,
			"1",
			watchedAt,
			true,
		);
		expect(episodeIndex).toHaveBeenCalledWith(
			"episode-uri",
			"new",
			expect.any(String),
			session.did,
			"2",
			1,
			1,
			originalDate,
			true,
		);
	},
);

it("recognizes an edited Watch by the original import key before writing", async () => {
	findFirst.mockResolvedValue({ id: "edited-watch" });
	expect(
		await writer.importNormalizedItems(session.did, session, [
			{ type: "movie", movieTmdbId: 1, watchedAt: originalDate },
		]),
	).toEqual({ imported: 0, skipped: 1, failed: 0, errors: [] });
	expect(applyWrites).not.toHaveBeenCalled();
});

it("does not report recovery success when the PDS read fails", async () => {
	applyWrites.mockRejectedValue(new Error("record already exists"));
	getRecord.mockRejectedValue(new Error("network failure"));
	const result = await writer.importNormalizedItems(session.did, session, [
		{ type: "movie", movieTmdbId: 1, watchedAt: originalDate },
	]);
	expect(result.failed).toBe(1);
	expect(movieIndex).not.toHaveBeenCalled();
});
