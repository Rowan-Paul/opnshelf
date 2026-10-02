import slugify from "slugify";
import type {
	NotificationCollectionItemDto,
	WatchRecapDto,
} from "./notifications.dto";

type Watch = {
	watchedDate: Date | null;
	mediaId: string;
	mediaType: "movie" | "show";
	title: string;
	posterPath: string | null;
	seasonNumber?: number;
	episodeNumber?: number;
};

export function buildWatchRecap(
	watches: Watch[],
	timezone: string,
): {
	recap: WatchRecapDto;
	items: NotificationCollectionItemDto[];
} {
	try {
		new Intl.DateTimeFormat("en", { timeZone: timezone });
	} catch {
		timezone = "UTC";
	}
	const dated = watches.filter(
		(watch): watch is Watch & { watchedDate: Date } =>
			watch.watchedDate !== null,
	);
	dated.sort(
		(a, b) =>
			a.watchedDate.getTime() - b.watchedDate.getTime() ||
			a.mediaType.localeCompare(b.mediaType) ||
			a.mediaId.localeCompare(b.mediaId) ||
			(a.seasonNumber ?? 0) - (b.seasonNumber ?? 0) ||
			(a.episodeNumber ?? 0) - (b.episodeNumber ?? 0),
	);
	const path = (watch: Watch) =>
		`/${watch.mediaType === "movie" ? "movies" : "shows"}/${watch.mediaId}/${slugify(watch.title, { lower: true, strict: true }) || "title"}`;
	const highlight = (watch: (typeof dated)[number] | undefined) =>
		watch
			? {
					title:
						watch.mediaType === "show"
							? `${watch.title} · S${watch.seasonNumber} E${watch.episodeNumber}`
							: watch.title,
					path: `${path(watch)}${watch.mediaType === "show" ? `/seasons/${watch.seasonNumber}/episodes/${watch.episodeNumber}` : ""}`,
					watchedAt: watch.watchedDate.toISOString(),
				}
			: null;
	const grouped = new Map<
		string,
		{ watch: Watch; count: number; latest: number }
	>();
	for (const watch of dated) {
		const key = `${watch.mediaType}:${watch.mediaId}`;
		const previous = grouped.get(key);
		grouped.set(key, {
			watch,
			count: (previous?.count ?? 0) + 1,
			latest: watch.watchedDate.getTime(),
		});
	}
	const ranked = [...grouped.values()].sort(
		(a, b) =>
			b.count - a.count ||
			b.latest - a.latest ||
			a.watch.mediaId.localeCompare(b.watch.mediaId),
	);
	const items = (["show", "movie"] as const).flatMap((type) =>
		ranked
			.filter(({ watch }) => watch.mediaType === type)
			.slice(0, 3)
			.map(({ watch, count }) => ({
				mediaId: watch.mediaId,
				mediaType: watch.mediaType,
				title: watch.title,
				posterPath: watch.posterPath,
				overview: "",
				releaseDate: null,
				seasonNumber: null,
				path: path(watch),
				watchCount: count,
			})),
	);
	return {
		recap: {
			movieWatches: dated.filter((w) => w.mediaType === "movie").length,
			episodeWatches: dated.filter((w) => w.mediaType === "show").length,
			timezone,
			firstWatch: highlight(dated[0]),
			lastWatch: highlight(dated.at(-1)),
		},
		items,
	};
}
