import type { MediaInListDto, ListDto } from "./dto/list.dto";
import { parseScopedShowMediaId } from "./list-media-id.util";

type ListItemRecord = {
	id: string;
	rkey: string;
	mediaType: "movie" | "show";
	mediaId: string;
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

export function mapItemToDto(item: ListItemRecord): MediaInListDto {
	const parsedShowScope =
		item.mediaType === "show"
			? parseScopedShowMediaId(item.mediaId)
			: undefined;
	const baseMediaId =
		item.mediaType === "show"
			? (parsedShowScope?.showId ?? item.mediaId)
			: item.mediaId;
	const mediaTitle =
		item.mediaType === "movie" ? item.movie?.title : item.show?.title;
	const mediaPosterPath =
		item.mediaType === "movie" ? item.movie?.posterPath : item.show?.posterPath;
	const mediaBackdropPath =
		item.mediaType === "movie"
			? item.movie?.backdropPath
			: item.show?.backdropPath;
	const mediaReleaseYear =
		item.mediaType === "movie"
			? item.movie?.releaseYear
			: item.show?.firstAirYear;
	const mediaReleaseDate =
		item.mediaType === "movie"
			? item.movie?.releaseDate
			: item.show?.firstAirDate;
	const mediaOverview =
		item.mediaType === "movie" ? item.movie?.overview : item.show?.overview;
	const mediaColors =
		item.mediaType === "movie" ? item.movie?.colors : item.show?.colors;

	return {
		id: item.id,
		rkey: item.rkey,
		mediaType: item.mediaType,
		mediaId: item.mediaId,
		seasonNumber: parsedShowScope?.seasonNumber,
		episodeNumber: parsedShowScope?.episodeNumber,
		notes: item.notes ?? undefined,
		position: item.position,
		createdAt: item.createdAt.toISOString(),
		media: {
			mediaType: item.mediaType,
			mediaId: baseMediaId,
			movieId: item.movie?.movieId,
			showId: item.show?.showId ?? parsedShowScope?.showId,
			seasonNumber: parsedShowScope?.seasonNumber,
			episodeNumber: parsedShowScope?.episodeNumber,
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
