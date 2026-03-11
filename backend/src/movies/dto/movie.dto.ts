import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsString } from "class-validator";

export class MovieColorsDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	primary?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	secondary?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	accent?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	muted?: string;
}

export class MovieDto {
	@ApiProperty()
	@IsString()
	movieId: string;

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
	releaseYear?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsDateString()
	releaseDate?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	overview?: string;

	@ApiPropertyOptional({ type: MovieColorsDto })
	@IsOptional()
	colors?: MovieColorsDto;
}

export class TrackedMovieDto {
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
	movieId: string;

	@ApiProperty()
	status: string;

	@ApiPropertyOptional()
	watchedDate?: string;

	@ApiProperty()
	createdAt: string;

	@ApiProperty()
	updatedAt: string;

	@ApiProperty({ type: MovieDto })
	movie: MovieDto;
}

export class SearchMoviesDto {
	@ApiProperty()
	@IsString()
	query: string;
}

export class DiscoverMoviesDto {
	@ApiPropertyOptional({
		description: "Sort order for results",
		enum: [
			"popularity.desc",
			"popularity.asc",
			"release_date.desc",
			"release_date.asc",
			"vote_average.desc",
			"vote_average.asc",
		],
		default: "popularity.desc",
	})
	@IsOptional()
	@IsString()
	sortBy?: string;

	@ApiPropertyOptional({
		description: "Filter by release year",
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

export class TMDBMovieResultDto {
	@ApiProperty()
	id: number;

	@ApiProperty()
	title: string;

	@ApiPropertyOptional()
	poster_path?: string;

	@ApiPropertyOptional()
	backdrop_path?: string;

	@ApiPropertyOptional()
	release_date?: string;

	@ApiPropertyOptional()
	overview?: string;
}

export class TMDBGenreDto {
	@ApiProperty()
	id: number;

	@ApiProperty()
	name: string;
}

export class TMDBCastDto {
	@ApiProperty()
	id: number;

	@ApiProperty()
	name: string;

	@ApiPropertyOptional()
	character?: string;

	@ApiPropertyOptional()
	profile_path?: string;

	@ApiProperty()
	order: number;
}

export class TMDBCrewDto {
	@ApiProperty()
	id: number;

	@ApiProperty()
	name: string;

	@ApiPropertyOptional()
	job?: string;

	@ApiPropertyOptional()
	department?: string;

	@ApiPropertyOptional()
	profile_path?: string;
}

export class TMDBNetworkDto {
	@ApiProperty()
	id: number;

	@ApiProperty()
	name: string;

	@ApiPropertyOptional()
	logo_path?: string;

	@ApiPropertyOptional()
	origin_country?: string;
}

export class TMDBCreditsDto {
	@ApiProperty({ type: [TMDBCastDto] })
	cast: TMDBCastDto[];

	@ApiProperty({ type: [TMDBCrewDto] })
	crew: TMDBCrewDto[];
}

export class TMDBTrailerDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	key: string;

	@ApiProperty()
	name: string;

	@ApiProperty()
	site: string;

	@ApiProperty()
	type: string;

	@ApiPropertyOptional()
	official?: boolean;

	@ApiPropertyOptional()
	published_at?: string;

	@ApiProperty({ enum: ["movie", "show", "season", "episode"] })
	sourceMediaType: "movie" | "show" | "season" | "episode";
}

export class TMDBMovieDetailDto extends TMDBMovieResultDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	runtime?: number;

	@ApiPropertyOptional()
	vote_average?: number;

	@ApiPropertyOptional()
	vote_count?: number;

	@ApiPropertyOptional({ type: [TMDBGenreDto] })
	genres?: TMDBGenreDto[];

	@ApiPropertyOptional({ type: MovieColorsDto })
	@IsOptional()
	colors?: MovieColorsDto;

	@ApiPropertyOptional({ type: TMDBCreditsDto })
	credits?: TMDBCreditsDto;

	@ApiPropertyOptional({ type: TMDBTrailerDto })
	trailer?: TMDBTrailerDto;
}

export class SearchResultsDto {
	@ApiProperty({ type: [TMDBMovieResultDto] })
	results: TMDBMovieResultDto[];

	@ApiProperty()
	total_results: number;

	@ApiProperty()
	page: number;
}

export class MarkWatchedDto {
	@ApiProperty({ description: "TMDB movie ID" })
	@IsString()
	movieId: string;

	@ApiPropertyOptional({
		description:
			"Custom watch datetime (ISO 8601). If not provided, current time is used.",
	})
	@IsOptional()
	@IsDateString()
	watchedAt?: string;
}

export class UnmarkWatchedDto {
	@ApiProperty({ description: "Movie ID to unmark" })
	@IsString()
	movieId: string;

	@ApiPropertyOptional({
		description:
			'Mode: "latest" removes most recent watch, "all" removes all watches',
		enum: ["latest", "all"],
		default: "latest",
	})
	@IsOptional()
	@IsString()
	mode?: "latest" | "all";
}

export class WatchHistoryItemDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	watchedDate: string;
}

export class PaginatedMoviesQueryDto {
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

export class PaginatedMoviesResponseDto {
	@ApiProperty({ type: [TrackedMovieDto] })
	items: TrackedMovieDto[];

	@ApiProperty({ description: "Cursor for next page (null if no more items)" })
	nextCursor: string | null;

	@ApiProperty({ description: "Total count of items" })
	total: number;
}
