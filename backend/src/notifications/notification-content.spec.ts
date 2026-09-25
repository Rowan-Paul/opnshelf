import { describe, expect, it } from "vitest";
import {
	collectionItems,
	notificationEmail,
	releaseTeaser,
} from "./notification-content";

const item = {
	mediaId: "42",
	mediaType: "movie" as const,
	title: '<A & "Movie">',
	posterPath: "/poster.jpg",
	overview: "A story <script>alert(1)</script>",
	releaseDate: "2026-09-25",
	seasonNumber: null,
	path: "/movies/42/a-movie",
};

describe("notification content", () => {
	it("includes every title, individual links, collection link and settings in both email formats", () => {
		const result = notificationEmail({
			title: "Weekend",
			body: "Your picks",
			url: "/discover/collections/saved",
			baseUrl: "https://staging.opnshelf.xyz",
			collection: {
				heading: "This week’s releases",
				periodStart: "2026-09-21",
				periodEnd: "2026-09-27",
				items: [
					item,
					{
						...item,
						mediaId: "43",
						title: "Second",
						path: "/movies/43/second",
						posterPath: null,
					},
				],
			},
		});
		for (const body of [result.text, result.html]) {
			expect(body).toContain("https://staging.opnshelf.xyz/movies/43/second");
			expect(body).toContain(
				"https://staging.opnshelf.xyz/discover/collections/saved",
			);
			expect(body).toContain(
				"https://staging.opnshelf.xyz/settings/notifications",
			);
		}
		expect(result.html).toContain("&lt;A &amp; &quot;Movie&quot;&gt;");
		expect(result.html).not.toContain("<script>");
		expect(result.html).toContain("https://image.tmdb.org/t/p/w342/poster.jpg");
		expect(result.html).not.toContain("/null");
	});
	it("keeps legacy deliveries and stats readable without a collection", () => {
		const result = notificationEmail({
			title: "Your weekly watch stats",
			body: "2 movies",
			url: "/",
			baseUrl: "https://opnshelf.xyz",
		});
		expect(result.html).toContain("2 movies");
		expect(result.text).toContain("Open in Opnshelf: https://opnshelf.xyz/");
	});
	it("rejects unsafe persisted links", () => {
		expect(() => collectionItems([{ ...item, path: "//evil.test" }])).toThrow();
		expect(() =>
			collectionItems([{ ...item, posterPath: '/x" onerror="bad' }]),
		).toThrow();
	});
	it("teases two names and counts the rest", () => {
		expect(
			releaseTeaser(
				Array.from({ length: 6 }, (_, i) => ({
					...item,
					title: `Title ${i + 1}`,
				})),
			),
		).toBe("Title 1 and Title 2, plus 4 more. Take a look.");
	});
});
