import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	IsArray,
	IsDateString,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	Min,
	ValidateIf,
	ValidateNested,
} from "class-validator";

export class NormalizedImportItemDto {
	@ApiProperty({ enum: ["movie", "episode"] })
	@IsString()
	@IsIn(["movie", "episode"])
	type: "movie" | "episode";

	@ApiProperty({ description: "UTC datetime in ISO-8601 format" })
	@IsDateString()
	watchedAt: string;

	@ApiPropertyOptional({ description: "TMDB movie id", type: Number })
	@ValidateIf((item: NormalizedImportItemDto) => item.type === "movie")
	@Type(() => Number)
	@IsInt()
	@Min(1)
	movieTmdbId?: number;

	@ApiPropertyOptional({ description: "TMDB show id", type: Number })
	@ValidateIf((item: NormalizedImportItemDto) => item.type === "episode")
	@Type(() => Number)
	@IsInt()
	@Min(1)
	showTmdbId?: number;

	@ApiPropertyOptional({ type: Number })
	@ValidateIf((item: NormalizedImportItemDto) => item.type === "episode")
	@Type(() => Number)
	@IsInt()
	@Min(0)
	seasonNumber?: number;

	@ApiPropertyOptional({ type: Number })
	@ValidateIf((item: NormalizedImportItemDto) => item.type === "episode")
	@Type(() => Number)
	@IsInt()
	@Min(1)
	episodeNumber?: number;

	@ApiPropertyOptional({ enum: ["watch", "scrobble", "checkin"] })
	@IsOptional()
	@IsString()
	@IsIn(["watch", "scrobble", "checkin"])
	action?: "watch" | "scrobble" | "checkin";
}

export class ImportSkipDto {
	@ApiProperty({ description: "1-based item index from source payload" })
	index: number;

	@ApiProperty({
		enum: [
			"unsupported_type",
			"unsupported_action",
			"missing_tmdb_id",
			"missing_episode_ref",
			"invalid_watched_at",
		],
	})
	reason:
		| "unsupported_type"
		| "unsupported_action"
		| "missing_tmdb_id"
		| "missing_episode_ref"
		| "invalid_watched_at";

	@ApiPropertyOptional()
	message?: string;
}

export class ImportErrorDto {
	@ApiProperty({ description: "1-based item index from request payload" })
	index: number;

	@ApiProperty({
		enum: [
			"invalid_item",
			"already_exists",
			"write_failed",
			"duplicate_in_request",
		],
	})
	code:
		| "invalid_item"
		| "already_exists"
		| "write_failed"
		| "duplicate_in_request";

	@ApiProperty()
	message: string;
}

export class FetchTraktPublicHistoryDto {
	@ApiProperty({ description: "Trakt username or slug" })
	@IsString()
	username: string;

	@ApiPropertyOptional({
		description:
			"Maximum items to fetch. If omitted, fetches full available history via pagination.",
		minimum: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	maxItems?: number;
}

export class TraktPublicProfileDto {
	@ApiProperty({ description: "Trakt username" })
	username: string;

	@ApiProperty({ description: "Trakt profile slug" })
	slug: string;

	@ApiPropertyOptional({ description: "Trakt display name" })
	name?: string;

	@ApiProperty({ description: "Whether the profile is private" })
	isPrivate: boolean;

	@ApiProperty({ description: "Whether the profile has Trakt VIP" })
	isVip: boolean;

	@ApiPropertyOptional({ description: "Profile avatar URL" })
	avatarUrl?: string;
}

export class TraktHistoryPreviewItemDto {
	@ApiProperty({ enum: ["movie", "episode"] })
	type: "movie" | "episode";

	@ApiProperty({ description: "Primary display title for this watch item" })
	title: string;

	@ApiPropertyOptional({ description: "Secondary context for this watch item" })
	subtitle?: string;

	@ApiProperty({ description: "UTC datetime in ISO-8601 format" })
	watchedAt: string;
}

export class FetchTraktPublicHistoryResponseDto {
	@ApiProperty({ type: TraktPublicProfileDto })
	profile: TraktPublicProfileDto;

	@ApiProperty({
		description: "Count of importable rows after normalization",
	})
	importableCount: number;

	@ApiProperty({ type: [TraktHistoryPreviewItemDto] })
	previewItems: TraktHistoryPreviewItemDto[];

	@ApiProperty({ type: [NormalizedImportItemDto] })
	items: NormalizedImportItemDto[];

	@ApiProperty({ type: [ImportSkipDto] })
	skipped: ImportSkipDto[];

	@ApiProperty({
		description: "Count of rows returned by Trakt before filtering",
	})
	sourceCount: number;
}

export class ImportHistoryDto {
	@ApiProperty({ type: [NormalizedImportItemDto], maxItems: 100 })
	@IsArray()
	@ArrayMaxSize(100)
	@ValidateNested({ each: true })
	@Type(() => NormalizedImportItemDto)
	items: NormalizedImportItemDto[];
}

export class ImportHistoryResponseDto {
	@ApiProperty()
	imported: number;

	@ApiProperty()
	skipped: number;

	@ApiProperty()
	failed: number;

	@ApiProperty({ type: [ImportErrorDto] })
	errors: ImportErrorDto[];
}

export class ImportBlueskyFollowsResponseDto {
	@ApiProperty({
		description: "Total Bluesky follows scanned from AppView",
	})
	scannedCount: number;

	@ApiProperty({
		description: "How many Bluesky follows already have OpnShelf accounts",
	})
	matchedCount: number;

	@ApiProperty({
		description: "How many new OpnShelf follows were created",
	})
	createdCount: number;

	@ApiProperty({
		description: "How many matched users were already followed",
	})
	alreadyFollowingCount: number;
}

export class CompleteOnboardingResponseDto {
	@ApiProperty({ description: "Timestamp when onboarding was completed" })
	onboardingCompletedAt: string;

	@ApiProperty({ default: false })
	needsOnboarding: boolean;
}
