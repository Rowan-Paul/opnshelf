vi.mock("../prisma/prisma.service", () => ({
	PrismaService: vi.fn(),
}));

import { NotFoundException } from "@nestjs/common";
import type { Agent } from "@atproto/api";
import type { PrismaService } from "../prisma/prisma.service";
import type { ReviewMediaService } from "./review-media.service";
import {
	blueskyLinkFacet,
	BlueskyCrossPostService,
	composeBlueskyPostText,
} from "./bluesky-cross-post.service";

describe("Bluesky post composition", () => {
	it("counts graphemes and truncates the Review title before media", () => {
		const mediaTitle = "A".repeat(150);
		const reviewTitle = `${"👨‍👩‍👧‍👦".repeat(200)} ending`;
		const text = composeBlueskyPostText(mediaTitle, reviewTitle);
		const count = Array.from(
			new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
		).length;
		expect(count).toBeLessThanOrEqual(300);
		expect(text).toContain(mediaTitle);
		expect(text).toContain("…");
	});

	it("falls back to trimming the media title once the Review title is gone", () => {
		const text = composeBlueskyPostText("B".repeat(400), "Short");
		const count = Array.from(
			new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
		).length;
		expect(count).toBeLessThanOrEqual(300);
		expect(text).toContain("Read my review");
	});

	it("uses UTF-8 byte offsets for the linked call to action", () => {
		const text = composeBlueskyPostText("Amélie 🎬", "Très bien");
		const uri = "https://opnshelf.xyz/reviews/alice/key";
		const facet = blueskyLinkFacet(text, uri);
		const bytes = Buffer.from(text, "utf8");
		expect(
			bytes.subarray(facet.index.byteStart, facet.index.byteEnd).toString(),
		).toBe("Read my review");
		expect(facet.features[0].uri).toBe(uri);
	});

	it("refuses to build a facet when the call to action is missing", () => {
		expect(() => blueskyLinkFacet("no cta here", "https://x.y")).toThrow(
			"Bluesky call to action missing from post text",
		);
	});
});

describe("BlueskyCrossPostService", () => {
	const mockPrisma = {
		user: { findUnique: vi.fn() },
		review: { update: vi.fn() },
	};
	const mockReviewMedia = { enrichMediaForReviews: vi.fn() };
	const mockPutRecord = vi.fn();
	const mockUploadBlob = vi.fn();
	const agent = {
		uploadBlob: mockUploadBlob,
		com: { atproto: { repo: { putRecord: mockPutRecord } } },
	} as unknown as Agent;

	const review = {
		id: "review-1",
		rkey: "rkey-1",
		title: "Fear is the mind-killer",
		mediaType: "movie",
		mediaId: "123",
		seasonNumber: 0,
		episodeNumber: 0,
		createdAt: new Date("2024-01-01"),
		blueskyPostUri: null,
		blueskyPostCid: null,
	};

	let service: BlueskyCrossPostService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new BlueskyCrossPostService(
			mockPrisma as unknown as PrismaService,
			mockReviewMedia as unknown as ReviewMediaService,
		);
	});

	it("returns the existing post without rewriting it", async () => {
		const result = await service.write("did:plc:abc123", agent, {
			...review,
			blueskyPostUri: "at://did:plc:abc123/app.bsky.feed.post/rkey-1",
			blueskyPostCid: "cid-post",
		});

		expect(result).toEqual({
			status: "posted",
			uri: "at://did:plc:abc123/app.bsky.feed.post/rkey-1",
			url: "https://bsky.app/profile/did:plc:abc123/post/rkey-1",
		});
		expect(mockPutRecord).not.toHaveBeenCalled();
		expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
	});

	it("does not post when the author disconnected Bluesky", async () => {
		mockPrisma.user.findUnique.mockResolvedValue({
			handle: "alice.example",
			blueskyCrossPostEnabled: false,
		});
		mockReviewMedia.enrichMediaForReviews.mockResolvedValue(
			new Map([
				[review.id, { label: "Dune", mediaTitle: "Dune", posterPath: null }],
			]),
		);

		await expect(
			service.write("did:plc:abc123", agent, review),
		).resolves.toEqual({ status: "not_requested" });
		expect(mockPutRecord).not.toHaveBeenCalled();
	});

	it("throws when the media or author cannot be resolved", async () => {
		mockPrisma.user.findUnique.mockResolvedValue({ handle: "alice.example" });
		mockReviewMedia.enrichMediaForReviews.mockResolvedValue(new Map());

		await expect(
			service.write("did:plc:abc123", agent, review),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("writes the post at the Review rkey and stores the pointer", async () => {
		mockPrisma.user.findUnique.mockResolvedValue({ handle: "alice.example" });
		mockReviewMedia.enrichMediaForReviews.mockResolvedValue(
			new Map([
				[review.id, { label: "Dune", mediaTitle: "Dune", posterPath: null }],
			]),
		);
		mockPutRecord.mockResolvedValue({
			data: {
				uri: "at://did:plc:abc123/app.bsky.feed.post/rkey-1",
				cid: "cid-post",
			},
		});
		mockPrisma.review.update.mockResolvedValue({});

		const result = await service.write("did:plc:abc123", agent, review);

		expect(mockPutRecord).toHaveBeenCalledWith(
			expect.objectContaining({
				repo: "did:plc:abc123",
				collection: "app.bsky.feed.post",
				rkey: "rkey-1",
				record: expect.objectContaining({
					text: "I reviewed Dune on Opnshelf: “Fear is the mind-killer”\n\nRead my review",
					embed: {
						$type: "app.bsky.embed.external",
						external: {
							uri: "https://opnshelf.xyz/movies/123/dune?review=%2Freviews%2Falice.example%2Frkey-1",
							title: "Fear is the mind-killer — Dune",
							description: "A review by @alice.example on Opnshelf.",
						},
					},
					createdAt: "2024-01-01T00:00:00.000Z",
				}),
			}),
		);
		// No poster, so no thumbnail upload was attempted.
		expect(mockUploadBlob).not.toHaveBeenCalled();
		expect(mockPrisma.review.update).toHaveBeenCalledWith({
			where: { id: "review-1" },
			data: {
				blueskyPostUri: "at://did:plc:abc123/app.bsky.feed.post/rkey-1",
				blueskyPostCid: "cid-post",
			},
		});
		expect(result).toEqual({
			status: "posted",
			uri: "at://did:plc:abc123/app.bsky.feed.post/rkey-1",
			url: "https://bsky.app/profile/did:plc:abc123/post/rkey-1",
		});
	});
});
