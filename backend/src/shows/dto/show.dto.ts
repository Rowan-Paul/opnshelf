import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	IsDateString,
	IsInt,
	IsOptional,
	IsString,
	Max,
	Min,
} from "class-validator";
import {
	MovieColorsDto,
	TMDBCastDto,
	TMDBCrewDto,
	TMDBCreditsDto,
	TMDBGenreDto,
	TMDBNetworkDto,
	TMDBTrailerDto,
} from "../../movies/dto/movie.dto";

export class ShowDto {
	@ApiProperty()
	@IsString()
	showId: string;

	@ApiProperty()
	@IsString()
	title: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	posterPath?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	backdropPath?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	firstAirYear?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsDateString()
	firstAirDate?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	overview?: string;

	@ApiPropertyOptional({ type: MovieColorsDto })
	@IsOptional()
	colors?: MovieColorsDto;
}

export class TrackedEpisodeDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	rkey: string;

	@ApiProperty()
	uri: string;

	@ApiProperty()
	cid: string;

	@ApiProperty()
	userDid: string;

	@ApiProperty()
	showId: string;

	@ApiProperty()
	seasonNumber: number;

	@ApiProperty()
	episodeNumber: number;

	@ApiProperty()
	status: string;

	@ApiPropertyOptional()
	watchedDate?: string;

	@ApiProperty()
	createdAt: string;

	@ApiProperty()
	updatedAt: string;

	@ApiProperty({ type: ShowDto })
	show: ShowDto;
}

export class TrackedShowSummaryDto {
	@ApiProperty()
	showId: string;

	@ApiProperty()
	watchCount: number;

	@ApiPropertyOptional()
	latestWatchedDate?: string;

	@ApiProperty({ type: ShowDto })
	show: ShowDto;
}

export class SearchShowsDto {
	@ApiProperty()
	@IsString()
	query: string;
}

export class DiscoverShowsDto {
	@ApiPropertyOptional({
		description: "Sort order for results",
		enum: [
			"popularity.desc",
			"popularity.asc",
			"first_air_date.desc",
			"first_air_date.asc",
			"vote_average.desc",
			"vote_average.asc",
		],
		default: "popularity.desc",
	})
	@IsOptional()
	@IsString()
	sortBy?: string;

	@ApiPropertyOptional({
		description: "Filter by first air date year",
	})
	@IsOptional()
	@IsInt()
	@Type(() => Number)
	year?: number;

	@ApiPropertyOptional({
		description: "Page number",
		default: 1,
	})
	@IsOptional()
	@IsInt()
	@Type(() => Number)
	page?: number;
}

export class TMDBShowResultDto {
	@ApiProperty()
	id: number;

	@ApiProperty()
	name: string;

	@ApiPropertyOptional()
	poster_path?: string;

	@ApiPropertyOptional()
	backdrop_path?: string;

	@ApiPropertyOptional()
	first_air_date?: string;

	@ApiPropertyOptional()
	overview?: string;
}

export class EpisodeReferenceDto {
	@ApiProperty()
	seasonNumber: number;

	@ApiProperty()
	episodeNumber: number;
}

export class UpNextEpisodeDto {
	@ApiProperty()
	seasonNumber: number;

	@ApiProperty()
	episodeNumber: number;

	@ApiProperty()
	name: string;

	@ApiPropertyOptional()
	airDate?: string;

	@ApiPropertyOptional()
	overview?: string;

	@ApiPropertyOptional()
	stillPath?: string;
}

export class UpNextShowDto {
	@ApiProperty()
	showId: string;

	@ApiProperty()
	watchCount: number;

	@ApiProperty()
	latestWatchedDate: string;

	@ApiProperty({ type: EpisodeReferenceDto })
	lastWatched: EpisodeReferenceDto;

	@ApiProperty({ type: UpNextEpisodeDto })
	nextEpisode: UpNextEpisodeDto;

	@ApiProperty({ type: ShowDto })
	show: ShowDto;
}

export class EpisodeContextDto {
	@ApiPropertyOptional({ type: EpisodeReferenceDto })
	previous: EpisodeReferenceDto | null;

	@ApiPropertyOptional({ type: EpisodeReferenceDto })
	next: EpisodeReferenceDto | null;
}

export class TMDBEpisodeDto {
	@ApiProperty()
	id: number;

	@ApiProperty()
	name: string;

	@ApiProperty()
	episode_number: number;

	@ApiProperty()
	season_number: number;

	@ApiPropertyOptional()
	air_date?: string;

	@ApiPropertyOptional()
	overview?: string;

	@ApiPropertyOptional()
	still_path?: string;

	@ApiPropertyOptional()
	vote_average?: number;

	@ApiPropertyOptional()
	vote_count?: number;

	@ApiPropertyOptional()
	runtime?: number;

	@ApiPropertyOptional()
	episode_type?: string;

	@ApiPropertyOptional()
	production_code?: string;

	@ApiPropertyOptional()
	show_id?: number;

	@ApiPropertyOptional({ type: [TMDBCrewDto] })
	crew?: TMDBCrewDto[];

	@ApiPropertyOptional({ type: [TMDBCastDto] })
	guest_stars?: TMDBCastDto[];

	@ApiPropertyOptional({ type: EpisodeContextDto })
	_context?: EpisodeContextDto;

	@ApiPropertyOptional({ type: TMDBTrailerDto })
	trailer?: TMDBTrailerDto;
}

export class TMDBSeasonDetailDto {
	@ApiProperty()
	id: number;

	@ApiPropertyOptional()
	_id?: string;

	@ApiProperty()
	name: string;

	@ApiProperty()
	season_number: number;

	@ApiPropertyOptional()
	overview?: string;

	@ApiPropertyOptional()
	poster_path?: string;

	@ApiPropertyOptional()
	air_date?: string;

	@ApiPropertyOptional()
	vote_average?: number;

	@ApiPropertyOptional({ type: [TMDBNetworkDto] })
	networks?: TMDBNetworkDto[];

	@ApiProperty({ type: [TMDBEpisodeDto] })
	episodes: TMDBEpisodeDto[];

	@ApiPropertyOptional({ type: TMDBTrailerDto })
	trailer?: TMDBTrailerDto;
}

export class TMDBSeasonSummaryDto {
	@ApiProperty()
	id: number;

	@ApiProperty()
	name: string;

	@ApiProperty()
	season_number: number;

	@ApiPropertyOptional()
	overview?: string;

	@ApiPropertyOptional()
	poster_path?: string;

	@ApiPropertyOptional()
	air_date?: string;

	@ApiPropertyOptional()
	episode_count?: number;

	@ApiPropertyOptional()
	vote_average?: number;
}

export class TMDBShowDetailDto extends TMDBShowResultDto {
	@ApiPropertyOptional({ type: [TMDBGenreDto] })
	genres?: TMDBGenreDto[];

	@ApiPropertyOptional()
	number_of_seasons?: number;

	@ApiPropertyOptional()
	number_of_episodes?: number;

	@ApiPropertyOptional({ type: [TMDBSeasonSummaryDto] })
	seasons?: TMDBSeasonSummaryDto[];

	@ApiPropertyOptional({ type: MovieColorsDto })
	@IsOptional()
	colors?: MovieColorsDto;

	@ApiPropertyOptional({ type: TMDBCreditsDto })
	credits?: {
		cast: TMDBCastDto[];
		crew: TMDBCrewDto[];
	};

	@ApiPropertyOptional({ type: TMDBTrailerDto })
	trailer?: TMDBTrailerDto;
}

export class SearchShowsResultsDto {
	@ApiProperty({ type: [TMDBShowResultDto] })
	results: TMDBShowResultDto[];

	@ApiProperty()
	total_results: number;

	@ApiProperty()
	page: number;
}

export class MarkEpisodeWatchedDto {
	@ApiProperty({ description: "TMDB show ID" })
	@IsString()
	showId: string;

	@ApiProperty({ description: "TMDB season number" })
	@Type(() => Number)
	@IsInt()
	seasonNumber: number;

	@ApiProperty({ description: "TMDB episode number" })
	@Type(() => Number)
	@IsInt()
	episodeNumber: number;

	@ApiPropertyOptional({
		description:
			"Custom watch datetime (ISO 8601). If not provided, current time is used.",
	})
	@IsOptional()
	@IsDateString()
	watchedAt?: string;
}

export class EpisodeHistoryItemDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	watchedDate: string;

	@ApiProperty()
	seasonNumber: number;

	@ApiProperty()
	episodeNumber: number;
}

export class PaginatedEpisodesQueryDto {
	@ApiPropertyOptional({
		description: "Number of items to return",
		default: 20,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	limit?: number;

	@ApiPropertyOptional({
		description: "Cursor for pagination (last item ID from previous page)",
	})
	@IsOptional()
	@IsString()
	cursor?: string;
}

export class PaginatedEpisodesResponseDto {
	@ApiProperty({ type: [TrackedEpisodeDto] })
	items: TrackedEpisodeDto[];

	@ApiProperty({ description: "Cursor for next page (null if no more items)" })
	nextCursor: string | null;

	@ApiProperty({ description: "Total count of items" })
	total: number;
}

export class PaginatedUpNextQueryDto {
	@ApiPropertyOptional({
		description: "Page number to return",
		default: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number;

	@ApiPropertyOptional({
		description: "Number of items to return per page",
		default: 8,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(50)
	pageSize?: number;
}

export class PaginatedUpNextResponseDto {
	@ApiProperty({ type: [UpNextShowDto] })
	items: UpNextShowDto[];

	@ApiProperty({ description: "Total count of items" })
	total: number;

	@ApiProperty({
		description: "Current page number after server-side clamping",
	})
	page: number;

	@ApiProperty({ description: "Number of items returned per page" })
	pageSize: number;

	@ApiProperty({ description: "Total number of available pages" })
	totalPages: number;

	@ApiProperty({ description: "Whether a previous page exists" })
	hasPreviousPage: boolean;

	@ApiProperty({ description: "Whether a next page exists" })
	hasNextPage: boolean;
}

export class ReleaseCalendarItemDto {
	@ApiProperty({ enum: ["watching", "watchlist"] })
	source: "watching" | "watchlist";

	@ApiProperty({ enum: ["movie", "show"] })
	mediaType: "movie" | "show";

	@ApiProperty({ enum: ["movie", "show", "episode"] })
	releaseKind: "movie" | "show" | "episode";

	@ApiProperty({ description: "Upcoming release date" })
	releaseDate: string;

	@ApiProperty()
	title: string;

	@ApiPropertyOptional()
	subtitle?: string;

	@ApiPropertyOptional()
	overview?: string;

	@ApiPropertyOptional()
	posterPath?: string;

	@ApiPropertyOptional()
	backdropPath?: string;

	@ApiPropertyOptional()
	showId?: string;

	@ApiPropertyOptional()
	movieId?: string;

	@ApiPropertyOptional()
	seasonNumber?: number;

	@ApiPropertyOptional()
	episodeNumber?: number;

	@ApiPropertyOptional({ type: MovieColorsDto })
	colors?: MovieColorsDto;
}

export class ReleaseCalendarResponseDto {
	@ApiProperty({ type: [ReleaseCalendarItemDto] })
	items: ReleaseCalendarItemDto[];

	@ApiProperty({ description: "Total count of upcoming release items" })
	total: number;
}

export class MarkSeasonWatchedDto {
	@ApiProperty({ description: "TMDB show ID" })
	@IsString()
	showId: string;

	@ApiProperty({ description: "TMDB season number" })
	@Type(() => Number)
	@IsInt()
	seasonNumber: number;

	@ApiPropertyOptional({
		description:
			"Custom watch datetime (ISO 8601). If not provided, current time is used.",
	})
	@IsOptional()
	@IsDateString()
	watchedAt?: string;
}

export class MarkShowWatchedDto {
	@ApiProperty({ description: "TMDB show ID" })
	@IsString()
	showId: string;

	@ApiPropertyOptional({
		description:
			"Custom watch datetime (ISO 8601). If not provided, current time is used.",
	})
	@IsOptional()
	@IsDateString()
	watchedAt?: string;
}

export class MarkedEpisodesResponseDto {
	@ApiProperty({ type: [TrackedEpisodeDto] })
	episodes: TrackedEpisodeDto[];

	@ApiProperty({ description: "Number of episodes marked as watched" })
	count: number;
}
