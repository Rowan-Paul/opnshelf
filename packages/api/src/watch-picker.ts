import type { WatchPickerItemDto } from "./generated/types.gen";
export type PickerFilters = {
	type: "both" | "movie" | "show";
	progress: "both" | "start" | "continue";
	genre: string;
	services?: string;
};
export function initialPickerFilters(serviceIds: number[]): PickerFilters {
	return {
		type: "both",
		progress: "both",
		genre: "",
		services: serviceIds.length ? serviceIds.join(",") : undefined,
	};
}
export function restorePickerFilters(
	value: string | null,
	fallback: PickerFilters,
): PickerFilters {
	try {
		const data = JSON.parse(value ?? "null");
		if (
			!data ||
			!["both", "movie", "show"].includes(data.type) ||
			!["both", "start", "continue"].includes(data.progress) ||
			typeof data.genre !== "string" ||
			data.genre.length > 100 ||
			(data.services !== undefined &&
				(typeof data.services !== "string" ||
					!/^[1-9][0-9]{0,8}(,[1-9][0-9]{0,8}){0,49}$/.test(data.services)))
		)
			return fallback;
		return {
			type: data.type,
			progress: data.progress,
			genre: data.genre,
			services: data.services,
		};
	} catch {
		return fallback;
	}
}
export function choosePickerItem(
	items: WatchPickerItemDto[],
	skipped: string[],
): WatchPickerItemDto | undefined {
	const remaining = items.filter((item) => !skipped.includes(item.id));
	return remaining[Math.floor(Math.random() * remaining.length)];
}
export function pickerEpisodeLabel(item: WatchPickerItemDto): string {
	const first = item.episodes[0];
	const last = item.episodes.at(-1);
	if (!first || !last) return "Movie";
	const label = (episode: typeof first) =>
		`S${episode.seasonNumber}E${episode.episodeNumber}`;
	return item.episodes.length === 1
		? `${label(first)} · ${first.name}`
		: `${label(first)}–${label(last)} · ${item.episodes.length} episodes`;
}

export function pickerServiceLabel(
	item: WatchPickerItemDto,
	id: number,
	name: string,
): string {
	const covered = item.episodes.filter((e) => e.serviceIds?.includes(id));
	if (!covered.length || covered.length === item.episodes.length) return name;
	const seasons = [...new Set(covered.map((e) => e.seasonNumber))];
	return `${name} · ${seasons.map((s) => `S${s}`).join(", ")}`;
}

// English genre names used by TMDB movie and TV detail responses.
export const PICKER_GENRES = [
	"Action",
	"Action & Adventure",
	"Adventure",
	"Animation",
	"Comedy",
	"Crime",
	"Documentary",
	"Drama",
	"Family",
	"Fantasy",
	"History",
	"Horror",
	"Kids",
	"Music",
	"Mystery",
	"News",
	"Reality",
	"Romance",
	"Science Fiction",
	"Sci-Fi & Fantasy",
	"Soap",
	"Talk",
	"Thriller",
	"TV Movie",
	"War",
	"War & Politics",
	"Western",
];
