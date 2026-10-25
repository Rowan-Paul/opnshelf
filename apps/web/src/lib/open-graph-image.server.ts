import type {
	CanonicalReviewResponseDto,
	ListWithItemsDto,
	PublicUserProfileDto,
	ShelfResponseDto,
} from "@opnshelf/api";
import sharp from "sharp";
import { env } from "#/env";

const WIDTH = 1200;
const HEIGHT = 630;
const BACKGROUND = "#0F172A";
const POSTER_PATH = /^\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/;

function escapeXml(value: string) {
	return value.replace(
		/[<>&"']/g,
		(char) =>
			({
				"<": "&lt;",
				">": "&gt;",
				"&": "&amp;",
				'"': "&quot;",
				"'": "&apos;",
			})[char] || char,
	);
}

async function textImage(
	value: string,
	width: number,
	height: number,
	size: number,
	color: string,
	bold = false,
) {
	const { data, info } = await sharp({
		text: {
			text: `<span foreground="${color}">${escapeXml(value.slice(0, 180))}</span>`,
			font: `DejaVu Sans ${bold ? "Bold " : ""}${size}`,
			width,
			dpi: 72,
			wrap: "word-char",
			rgba: true,
		},
	})
		.png()
		.toBuffer({ resolveWithObject: true });
	return info.height > height
		? sharp(data).resize(width, height, { fit: "inside" }).png().toBuffer()
		: data;
}

type SharingCard = {
	title: string;
	subtitle: string;
	footer?: string;
	items?: Array<{ title: string; posterPath?: unknown }>;
	posterPath?: string;
};

/** Render only trusted local shapes and bounded TMDB images; SVG text is escaped. */
export async function renderOpenGraphImage(card?: SharingCard) {
	const single = Boolean(card?.posterPath);
	const items = single
		? [{ title: card?.title || "", posterPath: card?.posterPath }]
		: card?.items?.slice(0, 8) || [];
	const itemWidth = single ? 324 : 146;
	const itemHeight = single ? 450 : 219;
	const left = (index: number) => (single ? 790 : 528 + (index % 4) * 158);
	const top = (index: number) =>
		single ? 92 : 84 + Math.floor(index / 4) * 231;
	const textWidth = single ? 640 : card?.items ? 420 : 1088;
	const posters = await Promise.all(
		items.map(async (item, index) => {
			const path = item.posterPath;
			if (typeof path !== "string" || !POSTER_PATH.test(path)) return null;
			try {
				const response = await fetch(
					`https://image.tmdb.org/t/p/${single ? "w500" : "w185"}${path}`,
					{
						signal: AbortSignal.timeout(3000),
						redirect: "error",
					},
				);
				if (!response.ok) return null;
				const input = Buffer.from(await response.arrayBuffer());
				if (input.length > 1_000_000) return null;
				return {
					input: await sharp(input, { limitInputPixels: 2_000_000 })
						.resize(itemWidth, itemHeight, {
							fit: "contain",
							background: BACKGROUND,
						})
						.png()
						.toBuffer(),
					left: left(index),
					top: top(index),
				};
			} catch {
				return null;
			}
		}),
	);
	const text = [
		{
			input: await textImage(
				card?.title || "Track what you watch.",
				textWidth,
				210,
				card?.items ? 48 : 60,
				"#F8FAFC",
				true,
			),
			left: 56,
			top: 194,
		},
		{
			input: await textImage(
				card?.subtitle || "Movies, shows, and your taste in good company.",
				textWidth,
				70,
				card ? 23 : 28,
				"#CBD5E1",
			),
			left: 56,
			top: card ? 448 : 383,
		},
	];
	const tiles = await Promise.all(
		items.map(async (item, index) => ({
			input:
				posters[index]?.input ||
				(await textImage(
					typeof item.title === "string" && item.title.trim()
						? item.title
						: "Media Item",
					122,
					190,
					18,
					"#CBD5E1",
				)),
			left: left(index) + (posters[index] ? 0 : 12),
			top: top(index) + (posters[index] ? 0 : 24),
		})),
	);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
	<rect width="1200" height="630" fill="${BACKGROUND}"/>
	<g transform="translate(52 58) scale(.25)"><path fill="#F8FAFC" d="M67 42h124c7 0 10 8 6 13l-14 17h-70c-27 0-47 20-47 46 0 15 7 28 19 37l-20 28h129v31H67c-23 0-39-16-39-39V81c0-23 16-39 39-39Z"/><path fill="#F3BC00" d="M96 158h52l13 22H81l15-22Z"/></g>
	<g font-family="DejaVu Sans, sans-serif" fill="#F8FAFC">
	<text x="128" y="103" font-size="32" font-weight="bold">Opnshelf</text>
	<text x="56" y="568" font-size="23" fill="#F3BC00">${escapeXml(card?.footer || "opnshelf.xyz")}</text>
	${items.map((_, index) => `<rect x="${left(index)}" y="${top(index)}" width="${itemWidth}" height="${itemHeight}" rx="6" fill="#1E293B"/>`).join("")}
	</g></svg>`;
	return sharp(Buffer.from(svg))
		.composite([...text, ...tiles])
		.png()
		.toBuffer();
}

async function publicJson<T>(path: string): Promise<T> {
	const response = await fetch(new URL(path, env.VITE_API_URL), {
		credentials: "omit",
		headers: { Accept: "application/json" },
		signal: AbortSignal.timeout(5000),
		redirect: "error",
	});
	if (!response.ok) throw response;
	return response.json();
}

export async function openGraphImageResponse(request: Request) {
	const params = new URL(request.url).searchParams;
	if ([...params.values()].some((value) => value.length > 500))
		return new Response("Invalid image parameters", { status: 400 });
	const handle = params.get("handle");
	const slug = params.get("list");
	const reviewKey = params.get("review");
	const release = params.get("release");
	let card: SharingCard | undefined;
	let status = 200;
	try {
		if (release) {
			const { publishedReleaseNotes } = await import("./release-notes.server");
			const entry = publishedReleaseNotes().find(
				(entry) => entry.slug === release,
			);
			if (!entry) throw new Response(null, { status: 404 });
			card = {
				title: entry.title,
				subtitle: entry.summary,
				footer: "Release Notes",
			};
		} else if (handle && reviewKey) {
			const review = await publicJson<CanonicalReviewResponseDto>(
				`/reviews/canonical/${encodeURIComponent(handle)}/${encodeURIComponent(reviewKey)}`,
			);
			card = {
				title: review.reviewTitle,
				subtitle: `by ${review.author.displayName || review.author.handle}`,
				footer: review.mediaLabel || review.mediaTitle || "Review",
				posterPath: review.posterPath,
			};
		} else if (handle) {
			const profile = await publicJson<PublicUserProfileDto>(
				`/users/${encodeURIComponent(handle)}/profile`,
			);
			const owner = profile.displayName || profile.handle;
			if (slug) {
				const list = await publicJson<ListWithItemsDto>(
					`/lists/user/${encodeURIComponent(profile.did)}/${encodeURIComponent(slug)}?sort=position&page=1&pageSize=8`,
				);
				card = {
					title: list.name,
					subtitle: `by ${owner}`,
					footer: `${list.total} ${list.total === 1 ? "item" : "items"}`,
					items: list.items.map((item) => ({
						title:
							typeof item.media.title === "string"
								? item.media.title
								: "Media Item",
						posterPath: item.media.posterPath,
					})),
				};
			} else {
				card = {
					title: params.get("view") === "shelf" ? `${owner}'s Shelf` : owner,
					subtitle: `@${profile.handle}`,
					items: [],
				};
				// Privacy applies to derived images too. Never query a private Shelf.
				if (profile.watchesPublic === true) {
					const shelf = await publicJson<ShelfResponseDto>(
						`/users/${encodeURIComponent(profile.did)}/shelf?page=1&pageSize=8&sortOrder=desc`,
					);
					card.items = shelf.items.map((item) => ({
						title: item.type === "movie" ? item.title : item.showTitle,
						posterPath: item.posterPath,
					}));
				}
			}
		} else if (slug || reviewKey || params.has("view")) {
			return new Response("Missing profile handle", { status: 400 });
		} else if (params.get("title")) {
			const posterPath = params.get("poster");
			if (posterPath && !POSTER_PATH.test(posterPath))
				return new Response("Invalid poster", { status: 400 });
			card = {
				title: params.get("title") || "Opnshelf",
				subtitle:
					params.get("subtitle") ||
					"Movies, shows, and your taste in good company.",
				posterPath: posterPath || undefined,
			};
		}
	} catch (error) {
		status =
			error instanceof Response && [401, 403, 404].includes(error.status)
				? 404
				: 503;
	}
	const image = await renderOpenGraphImage(status === 200 ? card : undefined);
	return new Response(new Uint8Array(image), {
		status,
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
		},
	});
}
