import type { LibraryFormat, LibraryItemDto } from "./dto/library.dto";

type LibraryItemRow = {
	id: string;
	rkey: string;
	mediaType: "movie" | "show" | "season" | "episode";
	mediaId: string;
	format: LibraryFormat;
	seasonNumber: number;
	episodeNumber: number;
	boxSet: string | null;
	notes: string | null;
	createdAt: Date;
	movie: {
		movieId: string;
		title: string;
		posterPath: string | null;
		backdropPath: string | null;
		releaseYear: number | null;
		releaseDate: Date | null;
		overview: string | null;
		colors: unknown;
	} | null;
	show: {
		showId: string;
		title: string;
		posterPath: string | null;
		backdropPath: string | null;
		firstAirYear: number | null;
		firstAirDate: Date | null;
		overview: string | null;
		colors: unknown;
	} | null;
};

export function mapLibraryItemToDto(
	item: LibraryItemRow,
	episodeName?: string,
): LibraryItemDto {
	const isShowLike = item.mediaType !== "movie";
	const title = isShowLike ? item.show?.title : item.movie?.title;
	const posterPath = isShowLike
		? item.show?.posterPath
		: item.movie?.posterPath;
	const backdropPath = isShowLike
		? item.show?.backdropPath
		: item.movie?.backdropPath;
	const releaseYear = isShowLike
		? item.show?.firstAirYear
		: item.movie?.releaseYear;
	const releaseDate = isShowLike
		? item.show?.firstAirDate
		: item.movie?.releaseDate;
	const overview = isShowLike ? item.show?.overview : item.movie?.overview;
	const colors = isShowLike ? item.show?.colors : item.movie?.colors;

	return {
		id: item.id,
		rkey: item.rkey,
		mediaType: item.mediaType,
		mediaId: item.mediaId,
		format: item.format,
		seasonNumber: item.seasonNumber || undefined,
		episodeNumber: item.episodeNumber || undefined,
		episodeName,
		boxSet: item.boxSet ?? undefined,
		notes: item.notes ?? undefined,
		createdAt: item.createdAt.toISOString(),
		media: {
			mediaType: item.mediaType,
			mediaId: item.mediaId,
			movieId: item.movie?.movieId,
			showId: isShowLike ? item.show?.showId : undefined,
			seasonNumber: item.seasonNumber || undefined,
			episodeNumber: item.episodeNumber || undefined,
			episodeName,
			title: title ?? "",
			posterPath: posterPath ?? undefined,
			backdropPath: backdropPath ?? undefined,
			releaseYear: releaseYear ?? undefined,
			releaseDate: releaseDate?.toISOString() ?? undefined,
			overview: overview ?? undefined,
			colors: (colors as LibraryItemDto["media"]["colors"]) ?? undefined,
		},
	};
}
