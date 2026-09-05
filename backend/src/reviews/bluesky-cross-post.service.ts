import type { Agent } from "@atproto/api";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewMediaService } from "./review-media.service";
import {
	type MediaType,
	mediaPageUrl,
	TMDB_IMAGE_BASE,
} from "./review-presentation";

const BLUESKY_APP_ORIGIN = "https://bsky.app";
const BLUESKY_POST_COLLECTION = "app.bsky.feed.post";
const BLUESKY_POST_MAX_GRAPHEMES = 300;
const BLUESKY_CTA = "Read my review";
const BLUESKY_THUMB_MAX_BYTES = 1_000_000;

export type BlueskyCrossPostResult =
	| { status: "not_requested" }
	| { status: "posted"; uri: string; url: string }
	| { status: "failed" };

/** The Review columns a Bluesky Cross-post reads and updates. */
export type CrossPostableReview = {
	id: string;
	rkey: string;
	title: string;
	mediaType: string;
	mediaId: string;
	seasonNumber: number;
	episodeNumber: number;
	createdAt: Date;
	blueskyPostUri: string | null;
	blueskyPostCid: string | null;
};

function graphemes(value: string): string[] {
	const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
	return Array.from(segmenter.segment(value), (part) => part.segment);
}

function truncateGraphemes(value: string, max: number): string {
	const parts = graphemes(value);
	if (parts.length <= max) return value;
	if (max <= 0) return "";
	if (max === 1) return "…";
	return `${parts.slice(0, max - 1).join("")}…`;
}

function crossPostText(mediaTitle: string, reviewTitle: string): string {
	return `I reviewed ${mediaTitle} on Opnshelf: “${reviewTitle}”\n\n${BLUESKY_CTA}`;
}

/** Compose within Bluesky's 300-grapheme limit, trimming review title first. */
export function composeBlueskyPostText(
	mediaTitle: string,
	reviewTitle: string,
): string {
	let resolvedReviewTitle = reviewTitle;
	let resolvedMediaTitle = mediaTitle;
	let text = crossPostText(resolvedMediaTitle, resolvedReviewTitle);

	if (graphemes(text).length > BLUESKY_POST_MAX_GRAPHEMES) {
		const withoutReview = crossPostText(resolvedMediaTitle, "");
		const reviewBudget = Math.max(
			0,
			BLUESKY_POST_MAX_GRAPHEMES - graphemes(withoutReview).length,
		);
		resolvedReviewTitle = truncateGraphemes(reviewTitle, reviewBudget);
		text = crossPostText(resolvedMediaTitle, resolvedReviewTitle);
	}

	if (graphemes(text).length > BLUESKY_POST_MAX_GRAPHEMES) {
		const withoutMedia = crossPostText("", resolvedReviewTitle);
		const mediaBudget = Math.max(
			0,
			BLUESKY_POST_MAX_GRAPHEMES - graphemes(withoutMedia).length,
		);
		resolvedMediaTitle = truncateGraphemes(mediaTitle, mediaBudget);
		text = crossPostText(resolvedMediaTitle, resolvedReviewTitle);
	}

	return text;
}

/** Rich-text facet offsets are UTF-8 bytes, not JS UTF-16 indices. */
export function blueskyLinkFacet(text: string, uri: string) {
	const start = text.lastIndexOf(BLUESKY_CTA);
	if (start < 0) {
		throw new Error("Bluesky call to action missing from post text");
	}
	return {
		index: {
			byteStart: Buffer.byteLength(text.slice(0, start), "utf8"),
			byteEnd: Buffer.byteLength(
				text.slice(0, start + BLUESKY_CTA.length),
				"utf8",
			),
		},
		features: [
			{
				$type: "app.bsky.richtext.facet#link",
				uri,
			},
		],
	};
}

/**
 * Writes the optional Bluesky Cross-post for a Review (an app.bsky.feed.post in
 * the author's own repo) and records the resulting pointer on the Review row.
 * The caller owns the "what if it fails" policy; this service throws.
 */
@Injectable()
export class BlueskyCrossPostService {
	private readonly logger = new Logger(BlueskyCrossPostService.name);

	constructor(
		private prisma: PrismaService,
		private reviewMedia: ReviewMediaService,
	) {}

	private async uploadThumbnail(
		agent: Agent,
		posterPath: string | null,
	): Promise<unknown | undefined> {
		if (!posterPath) return undefined;
		try {
			const response = await fetch(`${TMDB_IMAGE_BASE}${posterPath}`);
			if (!response.ok) return undefined;
			const contentType = response.headers.get("content-type") ?? "";
			if (!contentType.startsWith("image/")) return undefined;
			const bytes = new Uint8Array(await response.arrayBuffer());
			if (bytes.byteLength > BLUESKY_THUMB_MAX_BYTES) return undefined;
			const uploaded = await agent.uploadBlob(bytes, { encoding: contentType });
			return uploaded.data.blob;
		} catch (error) {
			this.logger.warn(
				"Bluesky card thumbnail upload failed; posting without it",
				error instanceof Error ? error.stack : undefined,
			);
			return undefined;
		}
	}

	async write(
		userDid: string,
		agent: Agent,
		review: CrossPostableReview,
	): Promise<BlueskyCrossPostResult> {
		if (review.blueskyPostUri) {
			return {
				status: "posted",
				uri: review.blueskyPostUri,
				url: `${BLUESKY_APP_ORIGIN}/profile/${userDid}/post/${review.rkey}`,
			};
		}

		const [user, mediaByReviewId] = await Promise.all([
			this.prisma.user.findUnique({
				where: { did: userDid },
				select: { handle: true, blueskyCrossPostEnabled: true },
			}),
			this.reviewMedia.enrichMediaForReviews([review]),
		]);
		const media = mediaByReviewId.get(review.id);
		if (!user || !media) {
			throw new NotFoundException("Review media or author not found");
		}
		if (user.blueskyCrossPostEnabled === false) {
			return { status: "not_requested" };
		}

		// Land readers on the media page with the review reader already open, so a
		// first-time visitor sees the title it is about instead of a bare review.
		const shareUrl = `${mediaPageUrl(
			review.mediaType as MediaType,
			review.mediaId,
			review.seasonNumber || undefined,
			review.episodeNumber || undefined,
			media.mediaTitle,
		)}?review=${encodeURIComponent(`/reviews/${user.handle}/${review.rkey}`)}`;
		const text = composeBlueskyPostText(media.label, review.title);
		const thumb = await this.uploadThumbnail(agent, media.posterPath);
		const external: Record<string, unknown> = {
			uri: shareUrl,
			title: `${review.title} — ${media.label}`,
			description: `A review by @${user.handle} on Opnshelf.`,
		};
		if (thumb) external.thumb = thumb;

		const response = await agent.com.atproto.repo.putRecord({
			repo: userDid,
			collection: BLUESKY_POST_COLLECTION,
			rkey: review.rkey,
			record: {
				$type: BLUESKY_POST_COLLECTION,
				text,
				facets: [blueskyLinkFacet(text, shareUrl)],
				embed: {
					$type: "app.bsky.embed.external",
					external,
				},
				createdAt: review.createdAt.toISOString(),
			},
		});

		await this.prisma.review.update({
			where: { id: review.id },
			data: {
				blueskyPostUri: response.data.uri,
				blueskyPostCid: response.data.cid,
			},
		});

		return {
			status: "posted",
			uri: response.data.uri,
			url: `${BLUESKY_APP_ORIGIN}/profile/${userDid}/post/${review.rkey}`,
		};
	}
}
