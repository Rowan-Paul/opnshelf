import type { FeaturedDto } from "./generated/types.gen";
import { slugifyName } from "./media-slug";

export function featuredMediaPath(
	item: Pick<FeaturedDto, "mediaType" | "mediaId" | "title" | "seasonNumber">,
): string {
	const base = `/${item.mediaType === "movie" ? "movies" : "shows"}/${item.mediaId}/${slugifyName(item.title)}`;
	return item.mediaType === "season"
		? `${base}/seasons/${item.seasonNumber}`
		: base;
}

export function featuredTitle(
	item: Pick<FeaturedDto, "title" | "mediaType" | "seasonNumber">,
): string {
	return item.mediaType === "season"
		? `${item.title} · ${item.seasonNumber === 0 ? "Specials" : `Season ${item.seasonNumber}`}`
		: item.title;
}

export function activeFeaturedItems(
	items: FeaturedDto[],
	now = Date.now(),
): FeaturedDto[] {
	return items.filter(item => item.active && Date.parse(item.expiresAt) > now);
}
