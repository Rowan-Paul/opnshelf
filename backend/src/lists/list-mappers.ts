import type { MediaInListDto, ListDto } from "./dto/list.dto";

type ListItemRecord = {
	id: string;
	rkey: string;
	mediaType: "movie" | "show" | "season" | "episode";
	mediaId: string;
	seasonNumber: number;
	episodeNumber: number;
	notes: string | null;
	position: number;
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

type ListRecord = {
	id: string;
	rkey: string;
	uri: string;
	userDid: string;
	name: string;
	description: string | null;
	slug: string;
	isDefault: boolean;
	createdAt: Date;
	updatedAt: Date;
	items: ListItemRecord[];
};

export function mapItemToDto(
	item: ListItemRecord,
	episodeName?: string,
	watchCount = 0,
): MediaInListDto {
	const isShowLike = item.mediaType !== "movie";
	// Only a movie or an episode is Watched. A show or season entry aggregates
	// its episodes' Watches, which is a different quantity, so it reports a
	// watched state but no count for anything to state.
	const hasOwnWatchCount =
		item.mediaType === "movie" || item.mediaType === "episode";
	const mediaTitle = isShowLike ? item.show?.title : item.movie?.title;
	const mediaPosterPath = isShowLike
		? item.show?.posterPath
		: item.movie?.posterPath;
	const mediaBackdropPath = isShowLike
		? item.show?.backdropPath
		: item.movie?.backdropPath;
	const mediaReleaseYear = isShowLike
		? item.show?.firstAirYear
		: item.movie?.releaseYear;
	const mediaReleaseDate = isShowLike
		? item.show?.firstAirDate
		: item.movie?.releaseDate;
	const mediaOverview = isShowLike ? item.show?.overview : item.movie?.overview;
	const mediaColors = isShowLike ? item.show?.colors : item.movie?.colors;

	return {
		id: item.id,
		rkey: item.rkey,
		mediaType: item.mediaType,
		mediaId: item.mediaId,
		seasonNumber: item.seasonNumber || undefined,
		episodeNumber: item.episodeNumber || undefined,
		episodeName,
		notes: item.notes ?? undefined,
		position: item.position,
		watched: watchCount > 0,
		watchCount: hasOwnWatchCount ? watchCount : 0,
		createdAt: item.createdAt.toISOString(),
		media: {
			mediaType: item.mediaType,
			mediaId: item.mediaId,
			movieId: item.movie?.movieId,
			showId: isShowLike ? item.show?.showId : undefined,
			seasonNumber: item.seasonNumber || undefined,
			episodeNumber: item.episodeNumber || undefined,
			episodeName,
			title: mediaTitle ?? "",
			posterPath: mediaPosterPath ?? undefined,
			backdropPath: mediaBackdropPath ?? undefined,
			releaseYear: mediaReleaseYear ?? undefined,
			releaseDate: mediaReleaseDate?.toISOString() ?? undefined,
			overview: mediaOverview ?? undefined,
			colors: (mediaColors as MediaInListDto["media"]["colors"]) ?? undefined,
		},
	};
}

export function mapListToDto(list: ListRecord): ListDto {
	return {
		id: list.id,
		rkey: list.rkey,
		uri: list.uri,
		userDid: list.userDid,
		name: list.name,
		description: list.description ?? undefined,
		slug: list.slug,
		isDefault: list.isDefault,
		createdAt: list.createdAt.toISOString(),
		updatedAt: list.updatedAt.toISOString(),
		items: list.items.map((item) => mapItemToDto(item)),
	};
}
