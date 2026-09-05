import type { Agent } from "@atproto/api";
import { Injectable, Logger } from "@nestjs/common";
import { main as markdownDef } from "../lexicons/at/markpub/markdown.defs";
import {
	$nsid as DOCUMENT_COLLECTION,
	main as documentSchema,
} from "../lexicons/site/standard/document";
import type { Main as DocumentRecord } from "../lexicons/site/standard/document.defs";
import { main as mediaLinkDef } from "../lexicons/xyz/opnshelf/mediaLink.defs";
import { PrismaService } from "../prisma/prisma.service";
import { documentToLeafletContent } from "./mirror/leaflet";
import {
	type DocumentBlock,
	type InlineRun,
	markdownToDocument,
} from "./mirror/markdown-to-doc";
import { documentToOffprintContent } from "./mirror/offprint";
import { documentToPcktContent } from "./mirror/pckt";
import { ReviewMediaService } from "./review-media.service";
import {
	excerpt,
	MEDIA_TYPE_LABEL,
	type MediaType,
	mediaPageUrl,
	PUBLIC_SITE_ORIGIN,
	TMDB_IMAGE_BASE,
	toPlainText,
} from "./review-presentation";

const OFFPRINT_ARTICLE_COLLECTION = "app.offprint.document.article";

export type PublicationService = "leaflet" | "offprint" | "pckt" | "unknown";

export function detectPublicationService(publication: {
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

const MAX_SLUG_LENGTH = 80;

// Slug for the blog-mirror document `path`. Falls back to "review" when a title
// slugifies to nothing (e.g. an all-emoji title).
export function slugify(title: string): string {
	const base = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, MAX_SLUG_LENGTH)
		.replace(/-$/, "");
	return base || "review";
}

/**
 * Frame the review body for the blog mirror: a small media header (poster +
 * linked title + type) on top and an opnshelf promo at the bottom. The footer is
 * a pitch, not a "read this review" backlink — the reader is already reading the
 * review here (e.g. on Leaflet), so it links to the media's opnshelf page to draw
 * them in. Any absent media info is simply omitted; the review body is always
 * present.
 */
export function buildMirrorContentMarkdown(params: {
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

type MirrorContentParams = {
	body: string;
	mediaTitle: string | null;
	mediaUrl: string;
	typeLabel: string;
};

export function buildLeafletMirrorContent(
	params: MirrorContentParams,
): Record<string, unknown> {
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

export function buildOffprintMirrorContent(
	params: MirrorContentParams,
): Record<string, unknown> {
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

export function buildPcktMirrorContent(
	params: MirrorContentParams,
): Record<string, unknown> {
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

export function buildDocumentRecord(params: {
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

/** The Review columns the Blog Mirror reads to render and track its document. */
export type MirrorableReview = {
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
};

export type BlogMirrorPointer = {
	blogDocumentUri: string | null;
	blogDocumentCid: string | null;
};

/**
 * Keeps the optional standard.site Blog Mirror (ADR-0013) of a Review in sync
 * with the author's Publication, in the reader-specific format they selected
 * (ADR-0014).
 */
@Injectable()
export class BlogMirrorService {
	private readonly logger = new Logger(BlogMirrorService.name);

	constructor(
		private prisma: PrismaService,
		private reviewMedia: ReviewMediaService,
	) {}

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
	async sync(
		userDid: string,
		agent: Agent,
		review: MirrorableReview,
	): Promise<BlogMirrorPointer> {
		const user = await this.prisma.user.findUnique({
			where: { did: userDid },
			select: {
				blogIntegrationEnabled: true,
				reviewsPublicationUri: true,
				reviewsMirrorFormat: true,
			},
		});
		// Disconnecting is an authorization change, not a content change. Keep any
		// existing pointer untouched and do not write or delete external records.
		if (user?.blogIntegrationEnabled === false) {
			return {
				blogDocumentUri: review.blogDocumentUri,
				blogDocumentCid: review.blogDocumentCid,
			};
		}
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
			const media = (
				await this.reviewMedia.enrichMediaForReviews([review])
			).get(review.id);
			const mediaLabel = media?.label ?? null;
			const mediaTitle = media?.mediaTitle ?? null;
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
				? `⚠️ Contains spoilers${mediaLabel ? ` for ${mediaLabel}` : ""}.`
				: undefined;
			const mirrorBody = spoilerWarning
				? `${spoilerWarning}\n\n${review.markdown}`
				: review.markdown;

			const contentMarkdown = buildMirrorContentMarkdown({
				body: mirrorBody,
				// Display gets the composite label; only the URL uses the parent title.
				mediaTitle: mediaLabel,
				posterPath: media?.posterPath ?? null,
				mediaUrl,
				typeLabel: MEDIA_TYPE_LABEL[mediaType],
			});
			const content =
				user?.reviewsMirrorFormat === "leaflet"
					? (buildLeafletMirrorContent({
							body: mirrorBody,
							mediaTitle: mediaLabel,
							mediaUrl,
							typeLabel: MEDIA_TYPE_LABEL[mediaType],
						}) as DocumentRecord["content"])
					: user?.reviewsMirrorFormat === "offprint"
						? (buildOffprintMirrorContent({
								body: mirrorBody,
								mediaTitle: mediaLabel,
								mediaUrl,
								typeLabel: MEDIA_TYPE_LABEL[mediaType],
							}) as DocumentRecord["content"])
						: user?.reviewsMirrorFormat === "pckt"
							? (buildPcktMirrorContent({
									body: mirrorBody,
									mediaTitle: mediaLabel,
									mediaUrl,
									typeLabel: MEDIA_TYPE_LABEL[mediaType],
								}) as DocumentRecord["content"])
							: undefined;

			const record = buildDocumentRecord({
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

	/**
	 * Best-effort removal of the mirror document when its Review is deleted. The
	 * Review record is already gone at this point, so a failure is logged rather
	 * than surfaced.
	 */
	async delete(
		repo: string,
		agent: Agent,
		review: { rkey: string; blogDocumentUri: string | null },
	): Promise<void> {
		if (!review.blogDocumentUri) return;
		try {
			await agent.com.atproto.repo.deleteRecord({
				repo,
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
}
