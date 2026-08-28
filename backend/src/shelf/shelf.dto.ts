import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
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

	@ApiProperty({ description: "Number of Watches logged for this movie" })
	watchCount: number;

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
	episodeTitle?: string;

	@ApiPropertyOptional()
	posterPath?: string;

	@ApiPropertyOptional()
	backdropPath?: string;

	@ApiPropertyOptional()
	stillPath?: string;

	@ApiPropertyOptional()
	firstAirYear?: number;

	@ApiPropertyOptional()
	overview?: string;

	@ApiPropertyOptional({ type: MovieColorsDto })
	colors?: MovieColorsDto;

	@ApiPropertyOptional()
	watchedDate?: string;

	@ApiProperty({ description: "Number of Watches logged for this episode" })
	watchCount: number;

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
		watchCount: { type: "number" },
		createdAt: { type: "string" },
	},
	required: ["id", "type", "movieId", "title", "watchCount", "createdAt"],
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
		episodeTitle: { type: "string" },
		posterPath: { type: "string" },
		backdropPath: { type: "string" },
		stillPath: { type: "string" },
		firstAirYear: { type: "number" },
		overview: { type: "string" },
		colors: { type: "object" },
		watchedDate: { type: "string" },
		watchCount: { type: "number" },
		createdAt: { type: "string" },
	},
	required: [
		"id",
		"type",
		"showId",
		"showTitle",
		"seasonNumber",
		"episodeNumber",
		"watchCount",
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

	@ApiPropertyOptional({
		description: "Filter by item type",
		enum: ["movie", "episode"],
	})
	@IsOptional()
	@IsString()
	type?: "movie" | "episode";

	@ApiPropertyOptional({
		description: "Search by title (case-insensitive partial match)",
	})
	@IsOptional()
	@IsString()
	search?: string;

	@ApiPropertyOptional({
		description: "Sort shelf items by date",
		enum: ["asc", "desc"],
		default: "desc",
	})
	@IsOptional()
	@IsIn(["asc", "desc"])
	sortOrder?: "asc" | "desc";
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

export class ShelfSyncStatusDto {
	@ApiProperty({
		description:
			"Whether the user's historical watch records are still being backfilled/ingested from their PDS. Drives the 'syncing your watch history…' indicator; poll while true.",
	})
	isSyncing: boolean;

	@ApiProperty({ description: "Number of tracked movies currently indexed" })
	trackedMovieCount: number;

	@ApiProperty({ description: "Number of tracked episodes currently indexed" })
	trackedEpisodeCount: number;

	@ApiPropertyOptional({
		description:
			"When the most recent backfill window opened (sign-in/sign-up), ISO 8601",
	})
	backfillStartedAt?: string;

	@ApiPropertyOptional({
		description: "When the last watch record was ingested, ISO 8601",
	})
	lastIngestAt?: string;
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
