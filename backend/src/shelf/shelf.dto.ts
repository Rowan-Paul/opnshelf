import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString } from "class-validator";
import { MovieColorsDto } from "../movies/dto/movie.dto";

export class ShelfItemMovieDto {
	@ApiProperty()
	id: string;

	@ApiProperty({ enum: ["movie"] })
	type: "movie";

	@ApiProperty()
	movieId: string;

	@ApiProperty()
	title: string;

	@ApiPropertyOptional()
	posterPath?: string;

	@ApiPropertyOptional()
	backdropPath?: string;

	@ApiPropertyOptional()
	releaseYear?: number;

	@ApiPropertyOptional()
	overview?: string;

	@ApiPropertyOptional({ type: MovieColorsDto })
	colors?: MovieColorsDto;

	@ApiPropertyOptional()
	watchedDate?: string;

	@ApiProperty()
	createdAt: string;
}

export class ShelfItemEpisodeDto {
	@ApiProperty()
	id: string;

	@ApiProperty({ enum: ["episode"] })
	type: "episode";

	@ApiProperty()
	showId: string;

	@ApiProperty()
	showTitle: string;

	@ApiProperty()
	seasonNumber: number;

	@ApiProperty()
	episodeNumber: number;

	@ApiPropertyOptional()
	posterPath?: string;

	@ApiPropertyOptional()
	backdropPath?: string;

	@ApiPropertyOptional()
	firstAirYear?: number;

	@ApiPropertyOptional()
	overview?: string;

	@ApiPropertyOptional({ type: MovieColorsDto })
	colors?: MovieColorsDto;

	@ApiPropertyOptional()
	watchedDate?: string;

	@ApiProperty()
	createdAt: string;
}

export const SHELF_ITEM_MOVIE_SCHEMA = {
	type: "object",
	properties: {
		id: { type: "string" },
		type: { type: "string", enum: ["movie"] },
		movieId: { type: "string" },
		title: { type: "string" },
		posterPath: { type: "string" },
		backdropPath: { type: "string" },
		releaseYear: { type: "number" },
		overview: { type: "string" },
		colors: { type: "object" },
		watchedDate: { type: "string" },
		createdAt: { type: "string" },
	},
	required: ["id", "type", "movieId", "title", "createdAt"],
};

export const SHELF_ITEM_EPISODE_SCHEMA = {
	type: "object",
	properties: {
		id: { type: "string" },
		type: { type: "string", enum: ["episode"] },
		showId: { type: "string" },
		showTitle: { type: "string" },
		seasonNumber: { type: "number" },
		episodeNumber: { type: "number" },
		posterPath: { type: "string" },
		backdropPath: { type: "string" },
		firstAirYear: { type: "number" },
		overview: { type: "string" },
		colors: { type: "object" },
		watchedDate: { type: "string" },
		createdAt: { type: "string" },
	},
	required: [
		"id",
		"type",
		"showId",
		"showTitle",
		"seasonNumber",
		"episodeNumber",
		"createdAt",
	],
};

export class ShelfQueryDto {
	@ApiPropertyOptional({
		description: "Number of items to return",
		default: 20,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	limit?: number;

	@ApiPropertyOptional({
		description:
			"Cursor for pagination (last item watchedDate from previous page)",
	})
	@IsOptional()
	@IsString()
	cursor?: string;
}

export class ShelfResponseDto {
	@ApiProperty({
		type: "array",
		items: {
			oneOf: [SHELF_ITEM_MOVIE_SCHEMA, SHELF_ITEM_EPISODE_SCHEMA],
		},
	})
	items: Array<ShelfItemMovieDto | ShelfItemEpisodeDto>;

	@ApiProperty({ description: "Cursor for next page (null if no more items)" })
	nextCursor: string | null;

	@ApiProperty({ description: "Total count of items" })
	total: number;
}
