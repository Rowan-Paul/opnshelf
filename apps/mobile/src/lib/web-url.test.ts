import { describe, expect, it, vi } from "vitest";
import { webReviewUrl } from "./web-url";

vi.mock("./env", () => ({ env: { siteUrl: "https://opnshelf.xyz" } }));

describe("webReviewUrl", () => {
	it("points at the media page with the review reader open", () => {
		expect(
			webReviewUrl(
				{ mediaType: "movie", mediaId: "693134", mediaTitle: "Dune: Part Two" },
				"alice.example",
				"abc123",
			),
		).toBe(
			"https://opnshelf.xyz/movies/693134/dune-part-two?review=%2Freviews%2Falice.example%2Fabc123",
		);
	});

	it("uses the show name from a composite episode title", () => {
		expect(
			webReviewUrl(
				{
					mediaType: "episode",
					mediaId: "1396",
					seasonNumber: 2,
					episodeNumber: 4,
					mediaTitle: "Breaking Bad — S2E4 — Down",
				},
				"alice.example",
				"abc123",
			),
		).toBe(
			"https://opnshelf.xyz/shows/1396/breaking-bad/seasons/2/episodes/4?review=%2Freviews%2Falice.example%2Fabc123",
		);
	});
});
