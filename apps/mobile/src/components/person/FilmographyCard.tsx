import type { PersonFilmographyItemDto } from "@opnshelf/api";
import { MediaCard } from "@/components/media/MediaCard";

/** Best human-readable role label for a (possibly merged) filmography credit. */
export function getRoleText(
	item: PersonFilmographyItemDto,
): string | undefined {
	if (item.character) return item.character;
	if (item.job) return item.job;
	if (item.roles && item.roles.length > 0) {
		const roles = item.roles.map((r) => r.character || r.job).filter(Boolean);
		return [...new Set(roles)].join(" / ") || undefined;
	}
	return undefined;
}

/** 4-digit year from a filmography credit's release / first-air date. */
export function getYear(item: PersonFilmographyItemDto): string | undefined {
	const date = item.release_date || item.first_air_date;
	if (!date) return undefined;
	const year = new Date(date).getFullYear();
	return Number.isNaN(year) ? undefined : String(year);
}

/** Filmography metadata on the shared movie/show card and shelf actions. */
export function FilmographyCard({ item }: { item: PersonFilmographyItemDto }) {
	const year = getYear(item);
	const role = getRoleText(item);
	return (
		<MediaCard
			actions
			item={{
				id: item.id,
				type: item.media_type === "movie" ? "movie" : "show",
				title: item.title,
				posterPath: item.poster_path,
				label: [year, role].filter(Boolean).join(" · "),
			}}
		/>
	);
}
