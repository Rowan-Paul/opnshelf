import { rebaseAvatarUrl } from "../users/avatar-url";
import { Agent } from "@atproto/api";
import { TID } from "@atproto/common";
import {
	ConflictException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { main as markdownDef } from "../lexicons/at/markpub/markdown.defs";
import { main as mediaLinkDef } from "../lexicons/xyz/opnshelf/mediaLink.defs";
import {
	$nsid as REVIEW_COLLECTION,
	main as reviewSchema,
} from "../lexicons/xyz/opnshelf/review";
import type { Main as ReviewRecord } from "../lexicons/xyz/opnshelf/review.defs";
import { $nsid as REVIEW_LIKE_COLLECTION } from "../lexicons/xyz/opnshelf/review/like";
import type { Main as ReviewLikeRecord } from "../lexicons/xyz/opnshelf/review/like.defs";
import {
	$nsid as DOCUMENT_COLLECTION,
	main as documentSchema,
} from "../lexicons/site/standard/document";
import type { Main as DocumentRecord } from "../lexicons/site/standard/document.defs";
import { $nsid as PUBLICATION_COLLECTION } from "../lexicons/site/standard/publication";
import type { Main as PublicationRecord } from "../lexicons/site/standard/publication.defs";
import { PrismaService } from "../prisma/prisma.service";
import { documentToLeafletContent } from "./mirror/leaflet";
import { documentToOffprintContent } from "./mirror/offprint";
import { documentToPcktContent } from "./mirror/pckt";
import {
	markdownToDocument,
	type DocumentBlock,
	type InlineRun,
} from "./mirror/markdown-to-doc";
import type {
	CreateReviewDto,
	MediaReviewsQueryDto,
	UpdateReviewDto,
} from "./dto/review.dto";

export interface ATSession {
	did: string;
}

// Canonical public site. NEVER opnshelf.social (that is only the PDS host).
const PUBLIC_SITE_ORIGIN = "https://opnshelf.xyz";
const BLUESKY_APP_ORIGIN = "https://bsky.app";
const BLUESKY_POST_COLLECTION = "app.bsky.feed.post";
const BLUESKY_POST_MAX_GRAPHEMES = 300;
const BLUESKY_CTA = "Read my review";
const BLUESKY_THUMB_MAX_BYTES = 1_000_000;

const PUBLICATION_LIST_LIMIT = 100;
const OFFPRINT_ARTICLE_COLLECTION = "app.offprint.document.article";

type PublicationService = "leaflet" | "offprint" | "pckt" | "unknown";

function detectPublicationService(publication: {
	url?: string;
	theme?: { $type?: string };
}): PublicationService {
	if (publication.theme?.$type?.startsWith("app.offprint.")) {
		return "offprint";
	}
	if (publication.theme?.$type?.startsWith("blog.pckt.")) {
		return "pckt";
	}
	try {
		const host = new URL(publication.url ?? "").hostname;
		if (host === "leaflet.pub" || host.endsWith(".leaflet.pub")) {
			return "leaflet";
		}
		if (host === "offprint.app" || host.endsWith(".offprint.app")) {
			return "offprint";
		}
		if (host === "pckt.blog" || host.endsWith(".pckt.blog")) {
			return "pckt";
		}
	} catch {
		// Unknown/invalid publication URLs fall back to the portable format.
	}
	return "unknown";
}

type MediaType = "movie" | "show" | "season" | "episode";

const MAX_SLUG_LENGTH = 80;

// Slug for the blog-mirror document `path`. Falls back to "review" when a title
// slugifies to nothing (e.g. an all-emoji title).
function slugify(title: string): string {
	const base = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, MAX_SLUG_LENGTH)
		.replace(/-$/, "");
	return base || "review";
}

/** Strip a small plaintext excerpt out of markdown for previews/mirror. */
function toPlainText(markdown: string): string {
	return markdown
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`[^`]*`/g, " ")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/[*_~>#-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function excerpt(plain: string, max = 280): string {
	if (plain.length <= max) return plain;
	return `${plain.slice(0, max - 1).trimEnd()}…`;
}

/** Short plaintext excerpt of a review body, computed on read (not stored). */
function excerptOf(markdown: string): string {
	return excerpt(toPlainText(markdown));
}

// Poster size for the metadata header of the blog mirror (a review-sized image,
// not a full-bleed backdrop).
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

export type BlueskyCrossPostResult =
	| { status: "not_requested" }
	| { status: "posted"; uri: string; url: string }
	| { status: "failed" };

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
	return `I reviewed ${mediaTitle} on OpnShelf: “${reviewTitle}”\n\n${BLUESKY_CTA}`;
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

const MEDIA_TYPE_LABEL: Record<MediaType, string> = {
	movie: "Movie",
	show: "TV series",
	season: "Season",
	episode: "Episode",
};

/**
 * Public opnshelf page for a media item. The trailing slug is cosmetic — web
 * routes resolve by id (and season/episode numbers) — so a slug of the media
 * title is fine even for the composite season/episode titles.
 */
function mediaPageUrl(
	mediaType: MediaType,
	mediaId: string,
	seasonNumber: number | undefined,
	episodeNumber: number | undefined,
	title: string,
): string {
	const slug = slugify(title);
	switch (mediaType) {
		case "movie":
			return `${PUBLIC_SITE_ORIGIN}/movies/${mediaId}/${slug}`;
		case "show":
			return `${PUBLIC_SITE_ORIGIN}/shows/${mediaId}/${slug}`;
		case "season":
			return `${PUBLIC_SITE_ORIGIN}/shows/${mediaId}/${slug}/seasons/${seasonNumber}`;
		case "episode":
			return `${PUBLIC_SITE_ORIGIN}/shows/${mediaId}/${slug}/seasons/${seasonNumber}/episodes/${episodeNumber}`;
	}
}

/**
 * Frame the review body for the blog mirror: a small media header (poster +
 * linked title + type) on top and an opnshelf promo at the bottom. The footer is
 * a pitch, not a "read this review" backlink — the reader is already reading the
 * review here (e.g. on Leaflet), so it links to the media's opnshelf page to draw
 * them in. Any absent media info is simply omitted; the review body is always
 * present.
 */
function buildMirrorContentMarkdown(params: {
	body: string;
	mediaTitle: string | null;
	posterPath: string | null;
	mediaUrl: string;
	typeLabel: string;
}): string {
	const blocks: string[] = [];
	if (params.mediaTitle) {
		if (params.posterPath) {
			blocks.push(
				`[![${params.mediaTitle}](${TMDB_IMAGE_BASE}${params.posterPath})](${params.mediaUrl})`,
			);
		}
		blocks.push(
			`**[${params.mediaTitle}](${params.mediaUrl})** · ${params.typeLabel}`,
		);
	}
	blocks.push(params.body);
	blocks.push("---");
	// Whole sentence is the link (bigger, more enticing click target).
	blocks.push(
		`*[Posted with opnshelf — track what you're watching and share your reviews on the open social web.](${params.mediaUrl})*`,
	);
	return blocks.join("\n\n");
}

function buildLeafletMirrorContent(params: {
	body: string;
	mediaTitle: string | null;
	mediaUrl: string;
	typeLabel: string;
}): Record<string, unknown> {
	const blocks: DocumentBlock[] = [];
	if (params.mediaTitle) {
		const header: InlineRun[] = [
			{ type: "bold", text: params.mediaTitle },
			{ type: "text", text: ` · ${params.typeLabel}` },
		];
		// The title is a single, generous link target; the poster is intentionally
		// omitted until we have a blob-upload path for remote TMDB artwork.
		header.splice(0, 1, {
			type: "link",
			text: params.mediaTitle,
			href: params.mediaUrl,
		});
		blocks.push({ type: "paragraph", runs: header });
	}
	blocks.push(...markdownToDocument(params.body));
	blocks.push({
		type: "paragraph",
		runs: [
			{
				type: "link",
				text: "Posted with opnshelf — track what you're watching and share your reviews on the open social web.",
				href: params.mediaUrl,
			},
		],
	});
	return documentToLeafletContent(blocks);
}

function buildOffprintMirrorContent(params: {
	body: string;
	mediaTitle: string | null;
	mediaUrl: string;
	typeLabel: string;
}): Record<string, unknown> {
	const blocks: DocumentBlock[] = [];
	if (params.mediaTitle) {
		blocks.push({
			type: "paragraph",
			runs: [
				{ type: "link", text: params.mediaTitle, href: params.mediaUrl },
				{ type: "text", text: ` · ${params.typeLabel}` },
			],
		});
	}
	blocks.push(...markdownToDocument(params.body));
	blocks.push({
		type: "paragraph",
		runs: [
			{
				type: "link",
				text: "Posted with opnshelf — track what you're watching and share your reviews on the open social web.",
				href: params.mediaUrl,
			},
		],
	});
	return documentToOffprintContent(blocks);
}

function buildPcktMirrorContent(params: {
	body: string;
	mediaTitle: string | null;
	mediaUrl: string;
	typeLabel: string;
}): Record<string, unknown> {
	const blocks: DocumentBlock[] = [];
	if (params.mediaTitle) {
		blocks.push({
			type: "paragraph",
			runs: [
				{ type: "link", text: params.mediaTitle, href: params.mediaUrl },
				{ type: "text", text: ` · ${params.typeLabel}` },
			],
		});
	}
	blocks.push(...markdownToDocument(params.body));
	blocks.push({
		type: "paragraph",
		runs: [
			{
				type: "link",
				text: "Posted with opnshelf — track what you're watching and share your reviews on the open social web.",
				href: params.mediaUrl,
			},
		],
	});
	return documentToPcktContent(blocks);
}

@Injectable()
export class ReviewsService {
	private readonly logger = new Logger(ReviewsService.name);

	constructor(private prisma: PrismaService) {}

	async getReview(reviewId: string) {
		return this.prisma.review.findUnique({ where: { id: reviewId } });
	}

	/**
	 * Resolve the canonical public review page (ADR-0013): `/reviews/{handle}/{rkey}`.
	 * Reviews are opnshelf-owned records, so the rkey is the stable identifier —
	 * there is no document `path` any more. Throws NotFoundException for an
	 * unknown handle or rkey so the controller surfaces a clean 404.
	 */
	async getCanonicalReview(handle: string, rkey: string) {
		const normalizedHandle = handle.trim().replace(/^@/, "").toLowerCase();
		const user = await this.prisma.user.findUnique({
			where: { handle: normalizedHandle },
			select: { did: true, handle: true, displayName: true, avatar: true },
		});
		if (!user) {
			throw new NotFoundException("Review not found");
		}

		const review = await this.prisma.review.findFirst({
			where: { userDid: user.did, rkey },
		});
		if (!review) {
			throw new NotFoundException("Review not found");
		}

		const mediaByReviewId = await this.enrichMediaForReviews([review]);
		const media = mediaByReviewId.get(review.id);

		return {
			id: review.id,
			rkey: review.rkey,
			title: review.title,
			markdown: review.markdown,
			spoiler: review.spoiler,
			description: excerptOf(review.markdown),
			mediaType: review.mediaType,
			mediaId: review.mediaId,
			seasonNumber: review.seasonNumber,
			episodeNumber: review.episodeNumber,
			mediaTitle: media?.title ?? null,
			posterPath: media?.posterPath ?? null,
			author: {
				did: user.did,
				handle: user.handle,
				displayName: user.displayName,
				avatar: rebaseAvatarUrl(user.avatar),
			},
			canonicalUrl: `${PUBLIC_SITE_ORIGIN}/reviews/${user.handle}/${review.rkey}`,
			createdAt: review.createdAt,
			updatedAt: review.updatedAt,
		};
	}

	/**
	 * Resolve `{ title, posterPath }` for each review's media item by joining the
	 * locally-indexed Movie/Show/Season/Episode tables. The cover is always the
	 * underlying media poster — a Review carries no cover of its own.
	 *
	 * Returned as a Map keyed by review id.
	 */
	private async enrichMediaForReviews(
		reviews: Array<{
			id: string;
			mediaType: string;
			mediaId: string;
			seasonNumber: number;
			episodeNumber: number;
		}>,
	): Promise<Map<string, { title: string; posterPath: string | null }>> {
		const movieIds = reviews
			.filter((r) => r.mediaType === "movie")
			.map((r) => r.mediaId);
		const showIds = reviews
			.filter((r) => r.mediaType === "show")
			.map((r) => r.mediaId);
		const seasonConditions = reviews
			.filter((r) => r.mediaType === "season")
			.map((r) => ({ showId: r.mediaId, seasonNumber: r.seasonNumber }));
		const episodeConditions = reviews
			.filter((r) => r.mediaType === "episode")
			.map((r) => ({
				showId: r.mediaId,
				seasonNumber: r.seasonNumber,
				episodeNumber: r.episodeNumber,
			}));

		const [movies, shows, seasons, episodes] = await Promise.all([
			movieIds.length > 0
				? this.prisma.movie.findMany({
						where: { movieId: { in: movieIds } },
					})
				: Promise.resolve([]),
			showIds.length > 0
				? this.prisma.show.findMany({
						where: { showId: { in: showIds } },
					})
				: Promise.resolve([]),
			seasonConditions.length > 0
				? this.prisma.season.findMany({
						where: { OR: seasonConditions },
						include: { show: true },
					})
				: Promise.resolve([]),
			episodeConditions.length > 0
				? this.prisma.episode.findMany({
						where: { OR: episodeConditions },
						include: { season: { include: { show: true } } },
					})
				: Promise.resolve([]),
		]);

		const movieMap = new Map<
			string,
			{ title: string; posterPath: string | null }
		>();
		for (const m of movies) {
			movieMap.set(m.movieId, { title: m.title, posterPath: m.posterPath });
		}
		const showMap = new Map<
			string,
			{ title: string; posterPath: string | null }
		>();
		for (const s of shows) {
			showMap.set(s.showId, { title: s.title, posterPath: s.posterPath });
		}
		const seasonMap = new Map<
			string,
			{ title: string; posterPath: string | null }
		>();
		for (const s of seasons) {
			const key = `${s.showId}:${s.seasonNumber}`;
			seasonMap.set(key, {
				title: `${s.show.title} — ${s.name}`,
				posterPath: s.posterPath ?? s.show.posterPath,
			});
		}
		const episodeMap = new Map<
			string,
			{ title: string; posterPath: string | null }
		>();
		for (const e of episodes) {
			const key = `${e.showId}:${e.seasonNumber}:${e.episodeNumber}`;
			episodeMap.set(key, {
				title: `${e.season.show.title} — S${e.seasonNumber}E${e.episodeNumber}: ${e.name}`,
				// Cover is always the portrait media poster, never the landscape
				// episode still — fall back season → show.
				posterPath: e.season.posterPath ?? e.season.show.posterPath,
			});
		}

		const byReviewId = new Map<
			string,
			{ title: string; posterPath: string | null }
		>();
		for (const review of reviews) {
			let media: { title: string; posterPath: string | null } | undefined;
			if (review.mediaType === "movie") {
				media = movieMap.get(review.mediaId);
			} else if (review.mediaType === "show") {
				media = showMap.get(review.mediaId);
			} else if (review.mediaType === "season") {
				media = seasonMap.get(`${review.mediaId}:${review.seasonNumber}`);
			} else if (review.mediaType === "episode") {
				media = episodeMap.get(
					`${review.mediaId}:${review.seasonNumber}:${review.episodeNumber}`,
				);
			}
			if (media) {
				byReviewId.set(review.id, media);
			}
		}

		return byReviewId;
	}

	private async uploadBlueskyThumbnail(
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

	private async writeBlueskyCrossPost(
		userDid: string,
		agent: Agent,
		review: {
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
		},
	): Promise<Extract<BlueskyCrossPostResult, { status: "posted" }>> {
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
				select: { handle: true },
			}),
			this.enrichMediaForReviews([review]),
		]);
		const media = mediaByReviewId.get(review.id);
		if (!user || !media) {
			throw new NotFoundException("Review media or author not found");
		}

		const canonicalUrl = `${PUBLIC_SITE_ORIGIN}/reviews/${user.handle}/${review.rkey}`;
		const text = composeBlueskyPostText(media.title, review.title);
		const thumb = await this.uploadBlueskyThumbnail(agent, media.posterPath);
		const external: Record<string, unknown> = {
			uri: canonicalUrl,
			title: `${review.title} — ${media.title}`,
			description: `A review by @${user.handle} on OpnShelf.`,
		};
		if (thumb) external.thumb = thumb;

		const response = await agent.com.atproto.repo.putRecord({
			repo: userDid,
			collection: BLUESKY_POST_COLLECTION,
			rkey: review.rkey,
			record: {
				$type: BLUESKY_POST_COLLECTION,
				text,
				facets: [blueskyLinkFacet(text, canonicalUrl)],
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

	async retryBlueskyCrossPost(
		userDid: string,
		session: ATSession,
		reviewId: string,
	): Promise<BlueskyCrossPostResult> {
		const review = await this.prisma.review.findFirst({
			where: { id: reviewId, userDid },
		});
		if (!review) throw new NotFoundException("Review not found");
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		try {
			return await this.writeBlueskyCrossPost(userDid, agent, review);
		} catch (error) {
			this.logger.warn(
				`Bluesky Cross-post failed for review ${review.rkey}`,
				error instanceof Error ? error.stack : undefined,
			);
			return { status: "failed" };
		}
	}

	async getUserReviews(userDid: string, limit = 20, cursor?: string) {
		const take = limit + 1;

		const reviews = await this.prisma.review.findMany({
			where: { userDid },
			orderBy: { createdAt: "desc" },
			take,
			...(cursor && {
				skip: 1,
				cursor: { id: cursor },
			}),
		});

		const hasMore = reviews.length > limit;
		const items = hasMore ? reviews.slice(0, limit) : reviews;
		const nextCursor = hasMore ? items[items.length - 1]?.id : null;

		const total = await this.prisma.review.count({
			where: { userDid },
		});

		const mediaByReviewId = await this.enrichMediaForReviews(items);

		const enrichedItems = items.map((review) => {
			const media = mediaByReviewId.get(review.id);
			return {
				...review,
				description: excerptOf(review.markdown),
				mediaTitle: media?.title,
				posterPath: media?.posterPath,
			};
		});

		return {
			items: enrichedItems,
			nextCursor,
			total,
		};
	}

	async getMediaReviews(
		query: MediaReviewsQueryDto,
		requestingUserDid?: string,
	) {
		const {
			mediaType,
			mediaId,
			seasonNumber,
			episodeNumber,
			limit = 20,
			pinnedReviewId,
		} = query;
		const take = limit + 1;

		const where = {
			mediaType,
			mediaId,
			seasonNumber: seasonNumber ?? 0,
			episodeNumber: episodeNumber ?? 0,
		};

		// Community-appreciation ordering: most-liked first, then most recent. The
		// author's own Rating is fetched per item below as a tiebreak among reviews
		// with identical like counts — the rating comes from the separate Rating
		// entity joined by (userDid + media coordinates), never from the review
		// (reviews carry no score). DB-level order stays (likeCount desc, createdAt
		// desc) so cursor pagination remains stable; the rating only reorders ties
		// within a returned page.
		const include = {
			user: {
				select: {
					did: true,
					handle: true,
					displayName: true,
					avatar: true,
				},
			},
			_count: {
				select: { likes: true },
			},
			likes: requestingUserDid
				? {
						where: { userDid: requestingUserDid },
						select: { id: true },
						take: 1,
					}
				: (false as const),
		};

		const reviews = await this.prisma.review.findMany({
			where,
			orderBy: [{ likes: { _count: "desc" } }, { createdAt: "desc" }],
			take,
			...(query.cursor && {
				skip: 1,
				cursor: { id: query.cursor },
			}),
			include,
		});

		const hasMore = reviews.length > limit;
		const items = hasMore ? reviews.slice(0, limit) : reviews;
		const nextCursor = hasMore ? items[items.length - 1]?.id : null;

		// Deep-link support: guarantee a specifically requested review is present
		// even when community ordering would push it past this page.
		if (pinnedReviewId && !items.some((r) => r.id === pinnedReviewId)) {
			const pinned = await this.prisma.review.findFirst({
				where: { ...where, id: pinnedReviewId },
				include,
			});
			if (pinned) {
				items.unshift(pinned);
			}
		}

		const total = await this.prisma.review.count({ where });

		// Join each author's separate Rating for this exact media item. There is no
		// stored pointer from a review to a rating — they correlate only by
		// (userDid + media coordinates).
		const authorDids = Array.from(new Set(items.map((r) => r.userDid)));
		const authorRatings =
			authorDids.length > 0
				? await this.prisma.rating.findMany({
						where: { ...where, userDid: { in: authorDids } },
						select: { userDid: true, rating: true },
					})
				: [];
		const ratingByAuthor = new Map<string, number>();
		for (const r of authorRatings) {
			ratingByAuthor.set(r.userDid, r.rating);
		}

		const mediaByReviewId = await this.enrichMediaForReviews(items);
		const enrichedItems = items.map((review) => ({
			...review,
			description: excerptOf(review.markdown),
			likeCount: review._count.likes,
			hasLiked: requestingUserDid ? review.likes.length > 0 : false,
			authorRating: ratingByAuthor.get(review.userDid) ?? null,
		}));

		// Apply the rating tiebreak among equal-likeCount neighbours, preserving
		// the DB createdAt order for items with no/identical ratings. Stable sort
		// keeps the cursor-defining order intact across pages.
		enrichedItems.sort((a, b) => {
			if (b.likeCount !== a.likeCount) return 0;
			const ra = a.authorRating ?? -1;
			const rb = b.authorRating ?? -1;
			return rb - ra;
		});

		return {
			items: enrichedItems.map((review) => {
				const media = mediaByReviewId.get(review.id);
				return {
					...review,
					mediaTitle: media?.title,
					posterPath: media?.posterPath ?? null,
				};
			}),
			total,
			nextCursor,
		};
	}

	/**
	 * Enumerate the user's own site.standard.publication records straight from
	 * their PDS. This live list — not the local cache — is the picker's source of
	 * truth and its ownership validation: only publications that exist in the
	 * requesting user's own repo can be returned. opnshelf no longer mints
	 * publications (ADR-0013), so there is no "opnshelf default" among them.
	 */
	async listMyPublications(
		userDid: string,
		session: ATSession,
	): Promise<
		Array<{
			uri: string;
			name: string;
			url: string;
			service: PublicationService;
		}>
	> {
		const user = await this.prisma.user.findUnique({
			where: { did: userDid },
			select: { handle: true },
		});
		if (!user) {
			throw new NotFoundException("User not found");
		}

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		const response = await agent.com.atproto.repo.listRecords({
			repo: session.did,
			collection: PUBLICATION_COLLECTION,
			limit: PUBLICATION_LIST_LIMIT,
		});

		return response.data.records.map((rec) => {
			const value = rec.value as {
				name?: string;
				url?: string;
				theme?: { $type?: string };
			};
			const url = value.url ?? "";
			return {
				uri: rec.uri,
				name: value.name ?? url,
				url,
				service: detectPublicationService(value),
			};
		});
	}

	private buildDocumentRecord(params: {
		publicationUri: string;
		title: string;
		/** Raw review body — used for the description/textContent excerpt. */
		body: string;
		/** When set (Spoiler Flag), replaces the description/textContent excerpt. */
		spoilerWarning?: string;
		/** Framed markdown (media header + body + backlink) — the rendered content. */
		contentMarkdown: string;
		/** Reader-specific rich body, or Markdown content for portable mirrors. */
		content?: DocumentRecord["content"];
		mediaType: MediaType;
		mediaId: string;
		seasonNumber?: number;
		episodeNumber?: number;
		path: string;
		publishedAt: string;
		updatedAt?: string;
	}): DocumentRecord {
		// Preview text stays about the review itself, not the media header/backlink.
		// A Spoiler Flag replaces it with the warning so previews can't leak.
		const plain = params.spoilerWarning ?? toPlainText(params.body);

		const content: DocumentRecord["content"] =
			params.content ??
			markdownDef.build({
				text: { markdown: params.contentMarkdown },
				flavor: "gfm",
			});

		const links: DocumentRecord["links"] = mediaLinkDef.build({
			mediaType: params.mediaType,
			mediaId: params.mediaId,
			seasonNumber: params.seasonNumber,
			episodeNumber: params.episodeNumber,
		});

		return documentSchema.build({
			site: params.publicationUri as DocumentRecord["site"],
			title: params.title,
			path: params.path,
			description: plain ? excerpt(plain) : undefined,
			textContent: plain || undefined,
			content,
			links,
			publishedAt: params.publishedAt as DocumentRecord["publishedAt"],
			updatedAt: params.updatedAt as DocumentRecord["updatedAt"],
		});
	}

	/**
	 * Reconcile the optional standard.site blog mirror (ADR-0013) to the author's
	 * current desired state, best-effort:
	 *   - publication selected + no mirror  → create the document
	 *   - publication selected + mirror     → rewrite the document
	 *   - no publication + mirror           → delete the document
	 * The mirror document reuses the review's rkey (rkey uniqueness is per
	 * collection) so we never track a second key. On failure we log and leave the
	 * stored pointer unchanged — the mirror is secondary to the opnshelf record.
	 *
	 * Returns the pointer to persist on the Review row.
	 */
	private async syncBlogMirror(
		userDid: string,
		agent: Agent,
		review: {
			id: string;
			rkey: string;
			title: string;
			markdown: string;
			spoiler: boolean;
			mediaType: string;
			mediaId: string;
			seasonNumber: number;
			episodeNumber: number;
			createdAt: Date;
			blogDocumentUri: string | null;
			blogDocumentCid: string | null;
			mirrorToBlog: boolean;
		},
	): Promise<{
		blogDocumentUri: string | null;
		blogDocumentCid: string | null;
	}> {
		const user = await this.prisma.user.findUnique({
			where: { did: userDid },
			select: { reviewsPublicationUri: true, reviewsMirrorFormat: true },
		});
		// Opted out per-review, or no blog configured: ensure no mirror exists.
		const publicationUri = review.mirrorToBlog
			? (user?.reviewsPublicationUri ?? null)
			: null;

		try {
			if (!publicationUri) {
				if (review.blogDocumentUri) {
					await agent.com.atproto.repo.deleteRecord({
						repo: userDid,
						collection: DOCUMENT_COLLECTION,
						rkey: review.rkey,
					});
					// A missing native article is harmless; the standard document is the
					// durable pointer we track locally.
					await agent.com.atproto.repo
						.deleteRecord({
							repo: userDid,
							collection: OFFPRINT_ARTICLE_COLLECTION,
							rkey: review.rkey,
						})
						.catch(() => undefined);
				}
				return { blogDocumentUri: null, blogDocumentCid: null };
			}

			const mediaType = review.mediaType as MediaType;
			const seasonNumber = review.seasonNumber || undefined;
			const episodeNumber = review.episodeNumber || undefined;

			// Resolve the media header (title + poster) and the opnshelf backlink.
			const media = (await this.enrichMediaForReviews([review])).get(review.id);
			const mediaTitle = media?.title ?? null;
			const mediaUrl = mediaTitle
				? mediaPageUrl(
						mediaType,
						review.mediaId,
						seasonNumber,
						episodeNumber,
						mediaTitle,
					)
				: PUBLIC_SITE_ORIGIN;

			// Blog readers can't render a Spoiler Shield (ADR-0016): flagged reviews
			// mirror in full, prefixed with a warning, and the warning also replaces
			// the body excerpt in the document's description/textContent.
			const spoilerWarning = review.spoiler
				? `⚠️ Contains spoilers${mediaTitle ? ` for ${mediaTitle}` : ""}.`
				: undefined;
			const mirrorBody = spoilerWarning
				? `${spoilerWarning}\n\n${review.markdown}`
				: review.markdown;

			const contentMarkdown = buildMirrorContentMarkdown({
				body: mirrorBody,
				mediaTitle,
				posterPath: media?.posterPath ?? null,
				mediaUrl,
				typeLabel: MEDIA_TYPE_LABEL[mediaType],
			});
			const content =
				user?.reviewsMirrorFormat === "leaflet"
					? (buildLeafletMirrorContent({
							body: mirrorBody,
							mediaTitle,
							mediaUrl,
							typeLabel: MEDIA_TYPE_LABEL[mediaType],
						}) as DocumentRecord["content"])
					: user?.reviewsMirrorFormat === "offprint"
						? (buildOffprintMirrorContent({
								body: mirrorBody,
								mediaTitle,
								mediaUrl,
								typeLabel: MEDIA_TYPE_LABEL[mediaType],
							}) as DocumentRecord["content"])
						: user?.reviewsMirrorFormat === "pckt"
							? (buildPcktMirrorContent({
									body: mirrorBody,
									mediaTitle,
									mediaUrl,
									typeLabel: MEDIA_TYPE_LABEL[mediaType],
								}) as DocumentRecord["content"])
							: undefined;

			const record = this.buildDocumentRecord({
				publicationUri,
				title: review.title,
				body: review.markdown,
				spoilerWarning,
				contentMarkdown,
				content,
				mediaType,
				mediaId: review.mediaId,
				seasonNumber,
				episodeNumber,
				// ponytail: re-slugs on title edit; blog URL is not guaranteed stable
				// across renames. Store the path on Review if that matters later.
				path: `/${slugify(review.title)}`,
				publishedAt: review.createdAt.toISOString(),
				updatedAt: new Date().toISOString(),
			});

			const response = await agent.com.atproto.repo.putRecord({
				repo: userDid,
				collection: DOCUMENT_COLLECTION,
				rkey: review.rkey,
				record,
				validate: false,
			});
			if (user?.reviewsMirrorFormat === "offprint") {
				await agent.com.atproto.repo.putRecord({
					repo: userDid,
					collection: OFFPRINT_ARTICLE_COLLECTION,
					rkey: review.rkey,
					record: {
						$type: OFFPRINT_ARTICLE_COLLECTION,
						document: {
							$type: "com.atproto.repo.strongRef",
							uri: response.data.uri,
							cid: response.data.cid,
						},
					},
					validate: false,
				});
			}

			return {
				blogDocumentUri: response.data.uri,
				blogDocumentCid: response.data.cid,
			};
		} catch (err) {
			this.logger.warn(
				`Blog mirror sync failed for review ${review.rkey}`,
				err instanceof Error ? err.stack : undefined,
			);
			return {
				blogDocumentUri: review.blogDocumentUri,
				blogDocumentCid: review.blogDocumentCid,
			};
		}
	}

	async createReview(
		userDid: string,
		session: ATSession,
		dto: CreateReviewDto,
	) {
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		const rkey = TID.nextStr();
		const now = new Date().toISOString();

		// mirrorToBlog is an opnshelf mirroring preference (like the publication
		// target on the User row), not review content — it lives only in the DB,
		// never on the federated review record.
		const mirrorToBlog = dto.mirrorToBlog ?? true;
		const record = reviewSchema.build({
			mediaType: dto.mediaType,
			mediaId: dto.mediaId,
			seasonNumber: dto.seasonNumber,
			episodeNumber: dto.episodeNumber,
			title: dto.title,
			content: dto.markdown,
			spoiler: dto.spoiler || undefined,
			createdAt: now as ReviewRecord["createdAt"],
			updatedAt: now as ReviewRecord["updatedAt"],
		});

		const response = await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: REVIEW_COLLECTION,
			rkey,
			record,
			validate: false,
		});

		const created = await this.prisma.review.create({
			data: {
				rkey,
				uri: response.data.uri,
				cid: response.data.cid,
				userDid,
				mediaType: dto.mediaType,
				mediaId: dto.mediaId,
				seasonNumber: dto.seasonNumber ?? 0,
				episodeNumber: dto.episodeNumber ?? 0,
				title: dto.title,
				markdown: dto.markdown,
				spoiler: dto.spoiler ?? false,
				mirrorToBlog,
			},
		});

		const mirror = await this.syncBlogMirror(userDid, agent, created);
		let finalReview = created;
		if (mirror.blogDocumentUri !== created.blogDocumentUri) {
			finalReview = await this.prisma.review.update({
				where: { id: created.id },
				data: mirror,
			});
		}

		let blueskyCrossPost: BlueskyCrossPostResult = {
			status: "not_requested",
		};
		if (dto.postToBluesky) {
			try {
				blueskyCrossPost = await this.writeBlueskyCrossPost(
					userDid,
					agent,
					finalReview,
				);
			} catch (error) {
				this.logger.warn(
					`Bluesky Cross-post failed for review ${finalReview.rkey}`,
					error instanceof Error ? error.stack : undefined,
				);
				blueskyCrossPost = { status: "failed" };
			}
		}

		return { ...finalReview, blueskyCrossPost };
	}

	async updateReview(
		userDid: string,
		session: ATSession,
		reviewId: string,
		dto: UpdateReviewDto,
	) {
		const existing = await this.prisma.review.findFirst({
			where: { id: reviewId, userDid },
		});
		if (!existing) {
			throw new NotFoundException("Review not found");
		}

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		const title = dto.title ?? existing.title;
		const markdown = dto.markdown ?? existing.markdown;
		const mirrorToBlog = dto.mirrorToBlog ?? existing.mirrorToBlog;
		const spoiler = dto.spoiler ?? existing.spoiler;

		const record = reviewSchema.build({
			mediaType: existing.mediaType,
			mediaId: existing.mediaId,
			seasonNumber: existing.seasonNumber || undefined,
			episodeNumber: existing.episodeNumber || undefined,
			title,
			content: markdown,
			spoiler: spoiler || undefined,
			createdAt: existing.createdAt.toISOString() as ReviewRecord["createdAt"],
			updatedAt: new Date().toISOString() as ReviewRecord["updatedAt"],
		});

		const response = await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: REVIEW_COLLECTION,
			rkey: existing.rkey,
			record,
			validate: false,
		});

		const mirror = await this.syncBlogMirror(userDid, agent, {
			...existing,
			title,
			markdown,
			spoiler,
			mirrorToBlog,
		});

		return this.prisma.review.update({
			where: { id: existing.id },
			data: {
				cid: response.data.cid,
				title,
				markdown,
				spoiler,
				mirrorToBlog,
				...mirror,
			},
		});
	}

	async deleteReview(
		userDid: string,
		session: ATSession,
		reviewId: string,
	): Promise<void> {
		const review = await this.prisma.review.findFirst({
			where: { id: reviewId, userDid },
		});

		if (!review) {
			throw new NotFoundException("Review not found");
		}

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		await agent.com.atproto.repo.deleteRecord({
			repo: session.did,
			collection: REVIEW_COLLECTION,
			rkey: review.rkey,
		});

		if (review.blogDocumentUri) {
			try {
				await agent.com.atproto.repo.deleteRecord({
					repo: session.did,
					collection: DOCUMENT_COLLECTION,
					rkey: review.rkey,
				});
			} catch (err) {
				this.logger.warn(
					`Failed to delete blog mirror for review ${review.rkey}`,
					err instanceof Error ? err.stack : undefined,
				);
			}
		}

		await this.prisma.review.delete({
			where: { id: reviewId },
		});
	}

	/**
	 * Mirror all of a user's existing reviews to their currently-configured blog
	 * (ADR-0013). Called when the author first selects a publication so reviews
	 * written *before* enabling the blog also appear there — not just new ones.
	 * Reviews opted out (mirrorToBlog === false) are skipped inside syncBlogMirror.
	 * Best-effort: each review syncs independently; syncBlogMirror swallows its
	 * own failures, so one bad write never aborts the rest.
	 *
	 * ponytail: inline, one PDS write per mirrored review. Fine for the handful of
	 * long-form reviews a user typically has; move to a queued job if someone
	 * turns up with hundreds.
	 */
	async backfillBlogMirror(userDid: string, session: ATSession): Promise<void> {
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);
		const reviews = await this.prisma.review.findMany({ where: { userDid } });
		for (const review of reviews) {
			const mirror = await this.syncBlogMirror(userDid, agent, review);
			if (
				mirror.blogDocumentUri !== review.blogDocumentUri ||
				mirror.blogDocumentCid !== review.blogDocumentCid
			) {
				await this.prisma.review.update({
					where: { id: review.id },
					data: mirror,
				});
			}
		}
	}

	async likeReview(userDid: string, session: ATSession, reviewId: string) {
		const review = await this.prisma.review.findUnique({
			where: { id: reviewId },
		});

		if (!review) {
			throw new NotFoundException("Review not found");
		}

		if (review.userDid === userDid) {
			throw new ForbiddenException("Cannot like your own review");
		}

		const existingLike = await this.prisma.reviewLike.findUnique({
			where: {
				userDid_reviewId: {
					userDid,
					reviewId,
				},
			},
		});

		if (existingLike) {
			throw new ConflictException("Already liked this review");
		}

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		const rkey = TID.nextStr();
		const record: ReviewLikeRecord = {
			$type: REVIEW_LIKE_COLLECTION,
			reviewUri: review.uri as unknown as ReviewLikeRecord["reviewUri"],
			createdAt: new Date().toISOString(),
		};

		const response = await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: REVIEW_LIKE_COLLECTION,
			rkey,
			record,
			validate: false,
		});

		const like = await this.prisma.reviewLike.create({
			data: {
				rkey,
				uri: response.data.uri,
				cid: response.data.cid,
				userDid,
				reviewId,
			},
		});

		return like;
	}

	async unlikeReview(userDid: string, session: ATSession, reviewId: string) {
		const like = await this.prisma.reviewLike.findUnique({
			where: {
				userDid_reviewId: {
					userDid,
					reviewId,
				},
			},
		});

		if (!like) {
			throw new NotFoundException("Like not found");
		}

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		await agent.com.atproto.repo.deleteRecord({
			repo: session.did,
			collection: REVIEW_LIKE_COLLECTION,
			rkey: like.rkey,
		});

		await this.prisma.reviewLike.delete({
			where: { id: like.id },
		});
	}

	async getReviewLikes(reviewId: string, requestingUserDid?: string) {
		const [items, total, hasLiked] = await Promise.all([
			this.prisma.reviewLike.findMany({
				where: { reviewId },
				orderBy: { createdAt: "desc" },
				include: {
					user: {
						select: {
							did: true,
							handle: true,
							displayName: true,
							avatar: true,
						},
					},
				},
			}),
			this.prisma.reviewLike.count({ where: { reviewId } }),
			requestingUserDid
				? this.prisma.reviewLike
						.findUnique({
							where: {
								userDid_reviewId: {
									userDid: requestingUserDid,
									reviewId,
								},
							},
						})
						.then((l) => !!l)
				: false,
		]);

		return {
			items: items.map((like) => ({
				userDid: like.user.did,
				userHandle: like.user.handle,
				userDisplayName: like.user.displayName ?? undefined,
				userAvatar: like.user.avatar ?? undefined,
				createdAt: like.createdAt.toISOString(),
			})),
			total,
			hasLiked,
		};
	}

	/**
	 * Index an xyz.opnshelf.review record from the firehose (ADR-0013). The
	 * caller (ingester) is responsible for the tracked-user check. The optional
	 * blog mirror is a separate site.standard.document and is NOT indexed as a
	 * review — only the opnshelf record is the source of truth.
	 */
	async indexReviewRecord(
		uri: string,
		cid: string,
		rkey: string,
		userDid: string,
		record: ReviewRecord,
	): Promise<void> {
		// mirrorToBlog is opnshelf-local (DB-only), not on the record: the create
		// path takes the column default (true) and updates leave it untouched, so
		// a per-review opt-out set via the API survives firehose re-indexing.
		await this.prisma.review.upsert({
			where: { rkey },
			create: {
				rkey,
				uri,
				cid,
				userDid,
				mediaType: record.mediaType,
				mediaId: record.mediaId,
				seasonNumber: record.seasonNumber ?? 0,
				episodeNumber: record.episodeNumber ?? 0,
				title: record.title,
				markdown: record.content,
				spoiler: record.spoiler ?? false,
			},
			update: {
				cid,
				mediaType: record.mediaType,
				mediaId: record.mediaId,
				seasonNumber: record.seasonNumber ?? 0,
				episodeNumber: record.episodeNumber ?? 0,
				title: record.title,
				markdown: record.content,
				spoiler: record.spoiler ?? false,
			},
		});
	}

	async deleteReviewRecord(rkey: string): Promise<void> {
		await this.prisma.review.deleteMany({
			where: { rkey },
		});
	}

	async indexPublicationRecord(
		uri: string,
		cid: string,
		rkey: string,
		userDid: string,
		record: PublicationRecord,
	): Promise<void> {
		// A repo may hold MANY publications (key is `tid`), so index by the unique
		// rkey — never by userDid, which is not unique on Publication.
		await this.prisma.publication.upsert({
			where: { rkey },
			create: {
				rkey,
				uri,
				cid,
				userDid,
				name: record.name,
				url: record.url,
			},
			update: {
				uri,
				cid,
				name: record.name,
				url: record.url,
			},
		});
	}

	async deletePublicationRecord(rkey: string): Promise<void> {
		await this.prisma.publication.deleteMany({
			where: { rkey },
		});
	}

	async indexReviewLikeRecord(
		uri: string,
		cid: string,
		rkey: string,
		userDid: string,
		record: ReviewLikeRecord,
	): Promise<void> {
		const review = await this.prisma.review.findFirst({
			where: { uri: record.reviewUri },
		});

		if (!review) {
			return;
		}

		await this.prisma.reviewLike.upsert({
			where: { rkey },
			create: {
				rkey,
				uri,
				cid,
				userDid,
				reviewId: review.id,
			},
			update: {
				cid,
				uri,
				reviewId: review.id,
			},
		});
	}

	async deleteReviewLikeRecord(rkey: string): Promise<void> {
		await this.prisma.reviewLike.deleteMany({
			where: { rkey },
		});
	}
}
