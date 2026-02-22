import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export type MediaType = "movie" | "tv";

export class UnifiedSearchResultDto {
	@ApiProperty()
	id: number;

	@ApiProperty({ enum: ["movie", "tv"] })
	media_type: MediaType;

	@ApiPropertyOptional()
	title?: string;

	@ApiPropertyOptional()
	name?: string;

	@ApiPropertyOptional()
	poster_path?: string;

	@ApiPropertyOptional()
	backdrop_path?: string;

	@ApiPropertyOptional()
	release_date?: string;

	@ApiPropertyOptional()
	first_air_date?: string;

	@ApiPropertyOptional()
	overview?: string;

	@ApiProperty()
	popularity: number;

	@ApiProperty()
	vote_average: number;

	@ApiProperty()
	vote_count: number;

	@ApiPropertyOptional()
	original_language?: string;

	@ApiPropertyOptional()
	genre_ids?: number[];

	@ApiPropertyOptional()
	original_title?: string;

	@ApiPropertyOptional()
	original_name?: string;

	@ApiPropertyOptional()
	adult?: boolean;

	@ApiPropertyOptional()
	video?: boolean;
}

export class UnifiedSearchResponseDto {
	@ApiProperty({ type: [UnifiedSearchResultDto] })
	results: UnifiedSearchResultDto[];

	@ApiProperty()
	total_results: number;

	@ApiProperty()
	page: number;
}

export class UnifiedDiscoverResponseDto {
	@ApiProperty({ type: [UnifiedSearchResultDto] })
	results: UnifiedSearchResultDto[];

	@ApiProperty()
	total_results: number;

	@ApiProperty()
	page: number;
}

export class DiscoverQueryDto {
	@ApiProperty({
		required: false,
		enum: [
			"popularity.desc",
			"popularity.asc",
			"vote_average.desc",
			"vote_average.asc",
			"release_date.desc",
			"release_date.asc",
			"primary_release_date.desc",
			"primary_release_date.asc",
		],
		default: "popularity.desc",
	})
	sortBy?: string;

	@ApiProperty({ required: false, minimum: 1, default: 1 })
	page?: number;

	@ApiProperty({ required: false, minimum: 1900, maximum: 2100 })
	year?: number;
}
