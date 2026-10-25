import { describe, expect, it } from "vitest";
import { getPageMeta, getSharingImageUrl } from "./media-meta";

describe("page sharing metadata", () => {
	it("includes matching Open Graph and Twitter text, an absolute URL, and a fallback image", () => {
		const tags = getPageMeta(
			{ title: "Favorites", description: "My favorites" },
			"/profile/test/lists/favorites",
		);
		expect(tags).toEqual(
			expect.arrayContaining([
				{ property: "og:title", content: "Favorites" },
				{ property: "og:description", content: "My favorites" },
				{ name: "twitter:title", content: "Favorites" },
				{ name: "twitter:description", content: "My favorites" },
				{ name: "twitter:card", content: "summary_large_image" },
			]),
		);
		const image = tags.find(
			(tag) => "property" in tag && tag.property === "og:image",
		);
		expect(image).toMatchObject({
			content: expect.stringMatching(/^https?:\/\/.+\/api\/og\?/),
		});
		expect(
			tags.find((tag) => "property" in tag && tag.property === "og:url"),
		).toMatchObject({
			content: expect.stringMatching(
				/^https?:\/\/.+\/profile\/test\/lists\/favorites$/,
			),
		});
	});

	it("wraps TMDB artwork in a landscape composition for both card formats", () => {
		const imageUrl = "https://image.tmdb.org/t/p/original/poster.jpg";
		expect(
			getPageMeta({ title: "List", description: "Titles", imageUrl }, "/"),
		).toEqual(
			expect.arrayContaining([
				{
					property: "og:image",
					content: getSharingImageUrl({
						title: "List",
						subtitle: "Titles",
						poster: "/poster.jpg",
					}),
				},
				{
					name: "twitter:image",
					content: getSharingImageUrl({
						title: "List",
						subtitle: "Titles",
						poster: "/poster.jpg",
					}),
				},
			]),
		);
	});
});
