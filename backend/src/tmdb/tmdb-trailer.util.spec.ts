import { selectBestTMDBTrailer, type TMDBVideo } from "./tmdb-trailer.util";

const video = (overrides: Partial<TMDBVideo> = {}): TMDBVideo => ({
	id: "video",
	key: "key",
	name: "Video",
	site: "YouTube",
	type: "Clip",
	...overrides,
});

describe("selectBestTMDBTrailer", () => {
	it("returns no trailer when no playable YouTube videos exist", () => {
		expect(selectBestTMDBTrailer(undefined, "movie")).toBeUndefined();
		expect(selectBestTMDBTrailer([], "movie")).toBeUndefined();
		expect(
			selectBestTMDBTrailer(
				[video({ site: "Vimeo" }), video({ key: "" })],
				"movie",
			),
		).toBeUndefined();
	});

	it("keeps the first video when different categories have equal scores", () => {
		const first = video({ id: "first", type: "Trailer" });
		const videos = [
			first,
			...Array.from({ length: 99 }, () => video()),
			video({ id: "later", type: "Trailer", official: true }),
		];
		expect(selectBestTMDBTrailer(videos, "show")?.id).toBe("first");
	});

	it("counts only playable candidates when scoring and leaves inputs intact", () => {
		const official = video({ id: "official", type: "Trailer", official: true });
		const videos = [
			video({ type: "Trailer" }),
			...Array.from({ length: 100 }, () => video({ site: "Vimeo" })),
			official,
		];
		const original = structuredClone(videos);
		expect(selectBestTMDBTrailer(videos, "episode")).toEqual({
			...official,
			published_at: undefined,
			sourceMediaType: "episode",
		});
		expect(videos).toEqual(original);
	});
});
