import type { FeaturedDto } from "./generated/types.gen";

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

/** Notify only when the next active entry expires, and stop when none remain. */
export function scheduleFeaturedExpiry(
	items: FeaturedDto[],
	onChange: (now: number) => void,
): () => void {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const refresh = () => {
		const now = Date.now();
		onChange(now);
		const next = Math.min(
			...activeFeaturedItems(items, now).map(item => Date.parse(item.expiresAt)),
		);
		if (Number.isFinite(next))
			timer = setTimeout(refresh, Math.min(next - now, 2_147_483_647));
	};
	refresh();
	return () => clearTimeout(timer);
}
