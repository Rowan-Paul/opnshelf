import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
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
		default: 20,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(50)
	pageSize?: number;
}

export class ShelfResponseDto {
	@ApiProperty({
		type: "array",
		items: {
			oneOf: [SHELF_ITEM_MOVIE_SCHEMA, SHELF_ITEM_EPISODE_SCHEMA],
		},
	})
	items: Array<ShelfItemMovieDto | ShelfItemEpisodeDto>;

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

export class ShelfActivityBucketDto {
	@ApiProperty({ description: "Local day key in YYYY-MM-DD format" })
	date: string;

	@ApiProperty({ description: "Number of items watched on that local day" })
	count: number;
}

export class ShelfActivitySummaryDto {
	@ApiProperty({ description: "Total watched in the last 7 days" })
	watchedLast7Days: number;

	@ApiProperty({ description: "Total watched in the last 30 days" })
	watchedLast30Days: number;

	@ApiProperty({ type: [ShelfActivityBucketDto] })
	dailyActivity: ShelfActivityBucketDto[];
}
