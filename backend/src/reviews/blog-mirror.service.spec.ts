vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn(),
}));

import type { Agent } from "@atproto/api";
import type { PrismaService } from "../prisma/prisma.service";
import type { ReviewMediaService } from "./review-media.service";
import {
	BlogMirrorService,
	buildLeafletMirrorContent,
	buildMirrorContentMarkdown,
	detectPublicationService,
	slugify,
} from "./blog-mirror.service";

describe("detectPublicationService", () => {
	it("recognises readers from their theme before their URL", () => {
		expect(
			detectPublicationService({
				url: "https://custom.example",
				theme: { $type: "app.offprint.theme" },
			}),
		).toBe("offprint");
		expect(
			detectPublicationService({
				url: "https://custom.example",
				theme: { $type: "blog.pckt.theme" },
			}),
		).toBe("pckt");
	});

	it("recognises readers from their hostnames, including subdomains", () => {
		expect(detectPublicationService({ url: "https://leaflet.pub/alice" })).toBe(
			"leaflet",
		);
		expect(
			detectPublicationService({ url: "https://alice.leaflet.pub/" }),
		).toBe("leaflet");
		expect(detectPublicationService({ url: "https://offprint.app/a" })).toBe(
			"offprint",
		);
		expect(detectPublicationService({ url: "https://me.pckt.blog" })).toBe(
			"pckt",
		);
	});

	it("falls back to the portable format for unknown or invalid URLs", () => {
		expect(
			detectPublicationService({ url: "https://my-own-blog.example" }),
		).toBe("unknown");
		expect(detectPublicationService({ url: "not a url" })).toBe("unknown");
		expect(detectPublicationService({})).toBe("unknown");
	});
});

describe("slugify (blog-mirror document path)", () => {
	it("lowercases and hyphenates", () => {
		expect(slugify("My Take: Dune (2021)!")).toBe("my-take-dune-2021");
	});

	it("falls back to 'review' when nothing survives", () => {
		expect(slugify("🎬🍿")).toBe("review");
	});

	it("caps the slug without leaving a trailing hyphen", () => {
		const slug = slugify(`${"a".repeat(79)} b`);
		expect(slug.length).toBeLessThanOrEqual(80);
		expect(slug.endsWith("-")).toBe(false);
	});
});

describe("buildMirrorContentMarkdown", () => {
	it("frames the body with a linked poster header and an opnshelf promo", () => {
		const rendered = buildMirrorContentMarkdown({
			body: "Loved it.",
			mediaTitle: "Dune",
			posterPath: "/dune.jpg",
			mediaUrl: "https://opnshelf.xyz/movies/123/dune",
			typeLabel: "Movie",
		});
		const blocks = rendered.split("\n\n");
		expect(blocks[0]).toBe(
			"[![Dune](https://image.tmdb.org/t/p/w342/dune.jpg)](https://opnshelf.xyz/movies/123/dune)",
		);
		expect(blocks[1]).toBe(
			"**[Dune](https://opnshelf.xyz/movies/123/dune)** · Movie",
		);
		expect(blocks[2]).toBe("Loved it.");
		expect(blocks[3]).toBe("---");
		expect(blocks[4]).toBe(
			"*[Posted with opnshelf — track what you're watching and share your reviews on the open social web.](https://opnshelf.xyz/movies/123/dune)*",
		);
	});

	it("omits the media header when the media is unknown", () => {
		const rendered = buildMirrorContentMarkdown({
			body: "Loved it.",
			mediaTitle: null,
			posterPath: "/ignored.jpg",
			mediaUrl: "https://opnshelf.xyz",
			typeLabel: "Movie",
		});
		expect(rendered.startsWith("Loved it.")).toBe(true);
		expect(rendered).not.toContain("image.tmdb.org");
	});
});

describe("buildLeafletMirrorContent", () => {
	it("leads with a linked media title and closes with the promo link", () => {
		const content = buildLeafletMirrorContent({
			body: "Loved it.",
			mediaTitle: "Dune",
			mediaUrl: "https://opnshelf.xyz/movies/123/dune",
			typeLabel: "Movie",
		}) as { $type: string; pages: Array<{ blocks: unknown[] }> };
		expect(content.$type).toBe("pub.leaflet.content");
		// header paragraph + body paragraph + promo paragraph
		expect(content.pages[0].blocks).toHaveLength(3);
	});
});

describe("BlogMirrorService", () => {
	const mockPrisma = { user: { findUnique: vi.fn() } };
	const mockReviewMedia = { enrichMediaForReviews: vi.fn() };
	const mockPutRecord = vi.fn();
	const mockDeleteRecord = vi.fn();
	const agent = {
		com: {
			atproto: {
				repo: { putRecord: mockPutRecord, deleteRecord: mockDeleteRecord },
			},
		},
	} as unknown as Agent;

	const review = {
		id: "review-1",
		rkey: "rkey-1",
		title: "My take",
		markdown: "Loved it.",
		spoiler: false,
		mediaType: "movie",
		mediaId: "123",
		seasonNumber: 0,
		episodeNumber: 0,
		createdAt: new Date("2024-01-01"),
		blogDocumentUri: "at://did:plc:abc123/site.standard.document/rkey-1",
		blogDocumentCid: "cid-doc",
		mirrorToBlog: true,
	};

	let service: BlogMirrorService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new BlogMirrorService(
			mockPrisma as unknown as PrismaService,
			mockReviewMedia as unknown as ReviewMediaService,
		);
	});

	it("removes an existing mirror when no Publication is selected any more", async () => {
		mockPrisma.user.findUnique.mockResolvedValue({
			reviewsPublicationUri: null,
		});
		mockDeleteRecord.mockResolvedValue({});

		const pointer = await service.sync("did:plc:abc123", agent, review);

		expect(mockDeleteRecord).toHaveBeenNthCalledWith(1, {
			repo: "did:plc:abc123",
			collection: "site.standard.document",
			rkey: "rkey-1",
		});
		// The Offprint native article is removed best-effort alongside it.
		expect(mockDeleteRecord).toHaveBeenNthCalledWith(2, {
			repo: "did:plc:abc123",
			collection: "app.offprint.document.article",
			rkey: "rkey-1",
		});
		expect(pointer).toEqual({ blogDocumentUri: null, blogDocumentCid: null });
	});

	it("keeps the stored pointer when a PDS write fails", async () => {
		mockPrisma.user.findUnique.mockResolvedValue({
			reviewsPublicationUri:
				"at://did:plc:abc123/site.standard.publication/leaflet",
		});
		mockReviewMedia.enrichMediaForReviews.mockResolvedValue(new Map());
		mockPutRecord.mockRejectedValue(new Error("PDS down"));

		const pointer = await service.sync("did:plc:abc123", agent, review);

		expect(pointer).toEqual({
			blogDocumentUri: review.blogDocumentUri,
			blogDocumentCid: review.blogDocumentCid,
		});
	});

	it("delete skips Reviews that never had a mirror", async () => {
		await service.delete("did:plc:abc123", agent, {
			rkey: "rkey-1",
			blogDocumentUri: null,
		});
		expect(mockDeleteRecord).not.toHaveBeenCalled();
	});

	it("delete swallows PDS failures", async () => {
		mockDeleteRecord.mockRejectedValue(new Error("gone"));
		await expect(
			service.delete("did:plc:abc123", agent, review),
		).resolves.toBeUndefined();
		expect(mockDeleteRecord).toHaveBeenCalledWith({
			repo: "did:plc:abc123",
			collection: "site.standard.document",
			rkey: "rkey-1",
		});
	});
});
