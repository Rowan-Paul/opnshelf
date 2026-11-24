import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class MovieWatchSuggestionDto {
	@ApiProperty({ enum: ["collection", "similar"] })
	kind!: "collection" | "similar";

	@ApiProperty()
	movieId!: string;

	@ApiProperty()
	title!: string;

	@ApiPropertyOptional()
	posterPath?: string;

	@ApiPropertyOptional()
	releaseDate?: string;

	@ApiPropertyOptional()
	runtime?: number;
}

export class MovieWatchSuggestionResponseDto {
	@ApiPropertyOptional({ type: MovieWatchSuggestionDto })
	suggestion?: MovieWatchSuggestionDto;
}
