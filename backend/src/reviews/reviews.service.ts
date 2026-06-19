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
import { $nsid as REVIEW_LIKE_COLLECTION } from "../lexicons/xyz/opnshelf/review/like";
import type { Main as ReviewLikeRecord } from "../lexicons/xyz/opnshelf/review/like.defs";
import {
	$nsid as DOCUMENT_COLLECTION,
	main as documentSchema,
} from "../lexicons/site/standard/document";
import type { Main as DocumentRecord } from "../lexicons/site/standard/document.defs";
import {
	$nsid as PUBLICATION_COLLECTION,
	main as publicationSchema,
} from "../lexicons/site/standard/publication";
import type { Main as PublicationRecord } from "../lexicons/site/standard/publication.defs";
import { PrismaService } from "../prisma/prisma.service";
import type {
	CreateReviewDto,
	MediaReviewsQueryDto,
	UpdateReviewDto,
} from "./dto/review.dto";

export interface ATSession {
	did: string;
}

// Canonical public site (ADR-0003). NEVER opnshelf.social (that is only the
// PDS host). Centralised here so #118 can swap the publication source.
const PUBLIC_SITE_ORIGIN = "https://opnshelf.xyz";

const PUBLICATION_LIST_LIMIT = 100;

type MediaType = "movie" | "show" | "season" | "episode";

const MAX_SLUG_LENGTH = 80;

// Mirrors the web `toSlug` util, capped so a canonical document `path` stays a
// sane URL segment. Falls back to "review" when a title slugifies to nothing
// (e.g. an all-emoji title).
function slugify(title: string): string {
	const base = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, MAX_SLUG_LENGTH)
		.replace(/-$/, "");
	return base || "review";
}

function publicationUrlForHandle(handle: string): string {
	return `${PUBLIC_SITE_ORIGIN}/@${handle}`;
}

function publicationNameForHandle(handle: string): string {
	return `${handle}'s OpnShelf`;
}

/** Strip a small plaintext excerpt out of markdown for cross-tool preview. */
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

@Injectable()
export class ReviewsService {
	private readonly logger = new Logger(ReviewsService.name);

	constructor(private prisma: PrismaService) {}

	async getReview(reviewId: string) {
		return this.prisma.review.findUnique({ where: { id: reviewId } });
	}

	/**
	 * Resolve the canonical public review page (#115) for `/@<handle>/<segment>`.
	 *
	 * `segment` is the last URL path segment that #114 emits in community-card
	 * links: the document `path` when present, otherwise the record key `rkey`
	 * (see reviews.controller.ts getMediaReviews). We MUST match on
	 * (path === segment) OR (rkey === segment), scoped to the handle's user, so
	 * the links already in the wild resolve. Handle is normalised the same way
	 * as public profile lookups (strip leading `@`, lowercase).
	 *
	 * Throws NotFoundException for an unknown handle or no matching document, so
	 * the controller surfaces a clean 404 (page renders a not-found state).
	 */
	async getCanonicalReview(handle: string, segment: string) {
		const normalizedHandle = handle.trim().replace(/^@/, "").toLowerCase();
		const user = await this.prisma.user.findUnique({
			where: { handle: normalizedHandle },
			select: { did: true, handle: true, displayName: true, avatar: true },
		});
		if (!user) {
			throw new NotFoundException("Review not found");
		}

		const review = await this.prisma.review.findFirst({
			where: {
				userDid: user.did,
				OR: [{ path: segment }, { rkey: segment }],
			},
		});
		if (!review) {
			throw new NotFoundException("Review not found");
		}

		const mediaByReviewId = await this.enrichMediaForReviews([review]);
		const media = mediaByReviewId.get(review.id);

		// Canonical URL on the public site (ADR-0003) — NEVER the PDS host. The
		// last segment mirrors the link emitted by #114 (path, falling back to
		// rkey).
		const canonicalUrl = `${PUBLIC_SITE_ORIGIN}/@${user.handle}/${
			review.path ?? review.rkey
		}`;

		return {
			id: review.id,
			rkey: review.rkey,
			title: review.title,
			markdown: review.markdown,
			description: review.description,
			path: review.path,
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
				avatar: user.avatar,
			},
			canonicalUrl,
			createdAt: review.createdAt,
			updatedAt: review.updatedAt,
		};
	}

	/**
	 * Resolve `{ title, posterPath }` for each review's media item by joining the
	 * locally-indexed Movie/Show/Season/Episode tables. This is the canonical way
	 * to obtain a review "cover" — Review documents carry NO per-document cover
	 * image (ADR-0002), so the cover is always the underlying media poster.
	 *
	 * Returned as a Map keyed by review id so callers can attach posters without
	 * re-deriving the media coordinate lookup.
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
				// Cover is always the portrait media poster (ADR-0002), never the
				// landscape episode still — fall back season → show.
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

		// Community-appreciation ordering (ADR-0002): most-liked first, then most
		// recent. The author's own Rating is fetched per item below as a tiebreak
		// among reviews with identical like counts — the rating MUST come from the
		// separate Rating entity joined by (userDid + media coordinates), never
		// from the review document (documents carry no score). The DB-level order
		// stays (likeCount desc, createdAt desc) so cursor pagination remains
		// stable; the rating only reorders ties within a returned page.
		const reviews = await this.prisma.review.findMany({
			where,
			orderBy: [{ likes: { _count: "desc" } }, { createdAt: "desc" }],
			take,
			...(query.cursor && {
				skip: 1,
				cursor: { id: query.cursor },
			}),
			include: {
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
					: false,
			},
		});

		const hasMore = reviews.length > limit;
		const items = hasMore ? reviews.slice(0, limit) : reviews;
		const nextCursor = hasMore ? items[items.length - 1]?.id : null;

		// Deep-link support: guarantee a specifically requested review is present
		// even when community-appreciation ordering would push it past this page.
		// It must match the same media coordinates, so it always belongs here.
		if (pinnedReviewId && !items.some((r) => r.id === pinnedReviewId)) {
			const pinned = await this.prisma.review.findFirst({
				where: { ...where, id: pinnedReviewId },
				include: {
					user: {
						select: {
							did: true,
							handle: true,
							displayName: true,
							avatar: true,
						},
					},
					_count: { select: { likes: true } },
					likes: requestingUserDid
						? {
								where: { userDid: requestingUserDid },
								select: { id: true },
								take: 1,
							}
						: false,
				},
			});
			if (pinned) {
				items.unshift(pinned);
			}
		}

		const total = await this.prisma.review.count({ where });

		// Join each author's separate Rating for this exact media item. There is
		// no stored pointer from a review to a rating — they correlate only by
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

		const [mediaByReviewId, enrichedItems] = await Promise.all([
			this.enrichMediaForReviews(items),
			Promise.resolve(
				items.map((review) => ({
					...review,
					likeCount: review._count.likes,
					hasLiked: requestingUserDid ? review.likes.length > 0 : false,
					authorRating: ratingByAuthor.get(review.userDid) ?? null,
				})),
			),
		]);

		// Apply the rating tiebreak among equal-likeCount neighbours, preserving
		// the DB createdAt order for items with no rating or identical ratings.
		// Stable sort keeps the cursor-defining (likeCount desc, createdAt desc)
		// order intact across pages.
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
	 * Lazily mint (or return) the opnshelf-owned site.standard.publication for a
	 * user. A repo may hold MANY publications (the canonical key is `tid`, not a
	 * fixed rkey — see ADR-0003), so idempotency CANNOT rely on the rkey. Instead
	 * opnshelf recognises its own minted publication by the deterministic url
	 * `opnshelf.xyz/@<handle>`: if such a row already exists we reuse it, else we
	 * mint a fresh one at a tid rkey.
	 */
	private async ensurePublication(
		userDid: string,
		session: ATSession,
		agent: Agent,
	): Promise<{ uri: string }> {
		const user = await this.prisma.user.findUnique({
			where: { did: userDid },
			select: { handle: true },
		});
		if (!user) {
			throw new NotFoundException("User not found");
		}

		const name = publicationNameForHandle(user.handle);
		const url = publicationUrlForHandle(user.handle);

		const existing = await this.prisma.publication.findFirst({
			where: { userDid, url },
		});
		if (existing) {
			return { uri: existing.uri };
		}

		const record: PublicationRecord = publicationSchema.build({
			url: url as PublicationRecord["url"],
			name,
		});

		const rkey = TID.nextStr();
		const response = await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: PUBLICATION_COLLECTION,
			rkey,
			record,
			validate: false,
		});

		await this.prisma.publication.upsert({
			where: { rkey },
			create: {
				rkey,
				uri: response.data.uri,
				cid: response.data.cid,
				userDid,
				name,
				url,
			},
			update: {
				uri: response.data.uri,
				cid: response.data.cid,
				name,
				url,
			},
		});

		return { uri: response.data.uri };
	}

	/**
	 * Enumerate the user's own site.standard.publication records straight from
	 * their PDS (D2). This live list — not the local cache — is the picker's
	 * source of truth and its ownership validation: only publications that exist
	 * in the requesting user's own repo can ever be returned. The opnshelf-minted
	 * publication is flagged via `isOpnshelfDefault` by matching the deterministic
	 * `opnshelf.xyz/@<handle>` url.
	 */
	async listMyPublications(
		userDid: string,
		session: ATSession,
	): Promise<
		Array<{
			uri: string;
			name: string;
			url: string;
			isOpnshelfDefault: boolean;
		}>
	> {
		const user = await this.prisma.user.findUnique({
			where: { did: userDid },
			select: { handle: true },
		});
		if (!user) {
			throw new NotFoundException("User not found");
		}
		const defaultUrl = publicationUrlForHandle(user.handle);

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		const response = await agent.com.atproto.repo.listRecords({
			repo: session.did,
			collection: PUBLICATION_COLLECTION,
			limit: PUBLICATION_LIST_LIMIT,
		});

		return response.data.records.map((rec) => {
			const value = rec.value as { name?: string; url?: string };
			const url = value.url ?? "";
			return {
				uri: rec.uri,
				name: value.name ?? url,
				url,
				isOpnshelfDefault: url === defaultUrl,
			};
		});
	}

	/**
	 * Re-point the user's already-published reviews at a new publication (D3/D4).
	 * Best-effort SEQUENTIAL: each document is rewritten changing ONLY `site`
	 * (and bumping `updatedAt`) while preserving title, content, mediaLink and
	 * `path` — so the canonical `opnshelf.xyz/@<handle>/<path>` URL stays stable —
	 * then `Review.publicationUri` is updated. There is no cross-PDS atomicity and
	 * no background queue; partial failures are surfaced in the summary.
	 */
	async repointReviews(
		userDid: string,
		session: ATSession,
		targetPublicationUri: string,
	): Promise<{ moved: number; failed: number; total: number }> {
		const reviews = await this.prisma.review.findMany({
			where: { userDid },
		});

		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		let moved = 0;
		let failed = 0;

		for (const review of reviews) {
			if (review.publicationUri === targetPublicationUri) {
				moved++;
				continue;
			}
			try {
				const record = this.buildDocumentRecord({
					publicationUri: targetPublicationUri,
					title: review.title,
					markdown: review.markdown,
					mediaType: review.mediaType as MediaType,
					mediaId: review.mediaId,
					seasonNumber: review.seasonNumber || undefined,
					episodeNumber: review.episodeNumber || undefined,
					path: review.path ?? undefined,
					publishedAt: review.createdAt.toISOString(),
					updatedAt: new Date().toISOString(),
				});

				const response = await agent.com.atproto.repo.putRecord({
					repo: session.did,
					collection: DOCUMENT_COLLECTION,
					rkey: review.rkey,
					record,
					validate: false,
				});

				await this.prisma.review.update({
					where: { id: review.id },
					data: {
						cid: response.data.cid,
						publicationUri: targetPublicationUri,
					},
				});
				moved++;
			} catch (err) {
				this.logger.warn(
					`Failed to re-point review ${review.id} to ${targetPublicationUri}`,
					err instanceof Error ? err.stack : undefined,
				);
				failed++;
			}
		}

		return { moved, failed, total: reviews.length };
	}

	// Generate a human, shareable document `path` from the title, unique within
	// the user's own reviews (the canonical page resolves by handle + path).
	// External standard.site tools build the canonical URL from publication.url +
	// document.path, so a real path — not the raw rkey — is what makes reviews
	// linkable off-platform.
	private async generateUniqueReviewPath(
		userDid: string,
		title: string,
	): Promise<string> {
		const base = slugify(title);
		const existing = await this.prisma.review.findMany({
			where: { userDid, path: { startsWith: base } },
			select: { path: true },
		});
		const taken = new Set(existing.map((r) => r.path));
		if (!taken.has(base)) return base;
		let n = 2;
		while (taken.has(`${base}-${n}`)) n++;
		return `${base}-${n}`;
	}

	private buildDocumentRecord(params: {
		publicationUri: string;
		title: string;
		markdown: string;
		mediaType: MediaType;
		mediaId: string;
		seasonNumber?: number;
		episodeNumber?: number;
		path?: string;
		publishedAt: string;
		updatedAt?: string;
	}): DocumentRecord {
		const plain = toPlainText(params.markdown);

		const content: DocumentRecord["content"] = markdownDef.build({
			text: { markdown: params.markdown },
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

	async createReview(
		userDid: string,
		session: ATSession,
		dto: CreateReviewDto,
	) {
		const agent = new Agent(
			session as unknown as ConstructorParameters<typeof Agent>[0],
		);

		// D6: when the user has chosen an override publication, point the document
		// `site` at the stored URI and SKIP minting entirely. A null override means
		// the default opnshelf publication (lazily minted here).
		const user = await this.prisma.user.findUnique({
			where: { did: userDid },
			select: { reviewsPublicationUri: true },
		});
		const publicationUri = user?.reviewsPublicationUri
			? user.reviewsPublicationUri
			: (await this.ensurePublication(userDid, session, agent)).uri;

		const rkey = TID.nextStr();
		const now = new Date().toISOString();
		const path = await this.generateUniqueReviewPath(userDid, dto.title);

		const record = this.buildDocumentRecord({
			publicationUri,
			title: dto.title,
			markdown: dto.markdown,
			mediaType: dto.mediaType,
			mediaId: dto.mediaId,
			seasonNumber: dto.seasonNumber,
			episodeNumber: dto.episodeNumber,
			path,
			publishedAt: now,
		});

		const response = await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: DOCUMENT_COLLECTION,
			rkey,
			record,
			validate: false,
		});

		return this.prisma.review.create({
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
				path,
				description: record.description ?? null,
				textContent: record.textContent ?? null,
				markdown: dto.markdown,
				publicationUri,
			},
		});
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

		const record = this.buildDocumentRecord({
			publicationUri: existing.publicationUri,
			title,
			markdown,
			mediaType: existing.mediaType,
			mediaId: existing.mediaId,
			seasonNumber: existing.seasonNumber,
			episodeNumber: existing.episodeNumber,
			// Keep the canonical path stable across edits (don't re-slug on title
			// change) so existing links never break.
			path: existing.path ?? undefined,
			publishedAt: existing.createdAt.toISOString(),
			updatedAt: new Date().toISOString(),
		});

		const response = await agent.com.atproto.repo.putRecord({
			repo: session.did,
			collection: DOCUMENT_COLLECTION,
			rkey: existing.rkey,
			record,
			validate: false,
		});

		return this.prisma.review.update({
			where: { id: existing.id },
			data: {
				cid: response.data.cid,
				title,
				markdown,
				description: record.description ?? null,
				textContent: record.textContent ?? null,
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
			collection: DOCUMENT_COLLECTION,
			rkey: review.rkey,
		});

		await this.prisma.review.delete({
			where: { id: reviewId },
		});
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
	 * Index a site.standard.document as a Review. Only documents carrying an
	 * xyz.opnshelf.mediaLink member are treated as opnshelf reviews; the caller
	 * (ingester) is responsible for the tracked-user check.
	 */
	async indexDocumentRecord(
		uri: string,
		cid: string,
		rkey: string,
		userDid: string,
		record: DocumentRecord,
	): Promise<void> {
		const link = record.links;
		// Not a review document — ignore arbitrary blog posts.
		if (!link || link.$type !== mediaLinkDef.$type) {
			return;
		}
		const mediaLink = link as {
			mediaType: MediaType;
			mediaId: string;
			seasonNumber?: number;
			episodeNumber?: number;
		};

		const markdown =
			record.content && record.content.$type === markdownDef.$type
				? ((record.content as { text?: { markdown?: string } }).text
						?.markdown ?? "")
				: "";

		await this.prisma.review.upsert({
			where: { rkey },
			create: {
				rkey,
				uri,
				cid,
				userDid,
				mediaType: mediaLink.mediaType,
				mediaId: mediaLink.mediaId,
				seasonNumber: mediaLink.seasonNumber ?? 0,
				episodeNumber: mediaLink.episodeNumber ?? 0,
				title: record.title,
				path: record.path ?? null,
				description: record.description ?? null,
				textContent: record.textContent ?? null,
				markdown,
				publicationUri: record.site,
			},
			update: {
				cid,
				mediaType: mediaLink.mediaType,
				mediaId: mediaLink.mediaId,
				seasonNumber: mediaLink.seasonNumber ?? 0,
				episodeNumber: mediaLink.episodeNumber ?? 0,
				title: record.title,
				path: record.path ?? null,
				description: record.description ?? null,
				textContent: record.textContent ?? null,
				markdown,
				publicationUri: record.site,
			},
		});
	}

	async deleteDocumentRecord(rkey: string): Promise<void> {
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
		// rkey — never by userDid, which is no longer unique on Publication.
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
