import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	IsBoolean,
	IsIn,
	IsOptional,
	IsString,
	ValidateIf,
} from "class-validator";

export class UpdateUserSettingsDto {
	@ApiProperty({
		description: "Time format preference",
		enum: ["12h", "24h"],
		required: false,
	})
	@IsString()
	@IsOptional()
	@IsIn(["12h", "24h"])
	timeFormat?: string;

	@ApiProperty({
		description: "IANA timezone identifier (e.g., America/New_York)",
		required: false,
	})
	@IsString()
	@IsOptional()
	timezone?: string;

	@ApiProperty({
		description:
			"ISO 3166-1 alpha-2 country code for streaming availability (e.g., US, GB)",
		required: false,
	})
	@IsString()
	@IsOptional()
	watchCountry?: string;

	@ApiPropertyOptional({
		description:
			"AT URI of the site.standard.publication that new reviews should point at. Must be one of the user's own publications. Pass null to revert to the opnshelf default.",
		nullable: true,
		type: String,
	})
	@IsString()
	@IsOptional()
	@ValidateIf((_, value) => value !== null)
	reviewsPublicationUri?: string | null;

	@ApiPropertyOptional({
		description:
			"Explicit reader format for blog mirrors. Markdown is the portable default.",
		enum: ["markdown", "leaflet", "offprint", "pckt"],
	})
	@IsString()
	@IsOptional()
	@IsIn(["markdown", "leaflet", "offprint", "pckt"])
	reviewsMirrorFormat?: string;
}

export class DeleteUserAccountDto {
	@ApiProperty({
		description:
			"Whether to delete the user's OpnShelf data from their PDS, including watch history, follows, lists, and list items. If false, the data remains on their PDS.",
		default: false,
	})
	@IsBoolean()
	@IsOptional()
	deletePDSData?: boolean;
}

export class AccountDeletionJobDto {
	@ApiProperty()
	id!: string;

	@ApiProperty({
		enum: ["queued", "running", "completed", "failed"],
	})
	status!: string;

	@ApiProperty()
	totalRecords!: number;

	@ApiProperty()
	deletedRecords!: number;

	@ApiPropertyOptional()
	currentStep?: string;

	@ApiPropertyOptional()
	lastError?: string;

	@ApiProperty()
	createdAt!: string;
}

export class UserSettingsDto {
	@ApiProperty({
		description: "Time format preference",
		enum: ["12h", "24h"],
	})
	timeFormat!: string;

	@ApiProperty({
		description: "IANA timezone identifier (e.g., America/New_York)",
	})
	timezone!: string;

	@ApiProperty({
		description:
			"ISO 3166-1 alpha-2 country code for streaming availability (e.g., US, GB)",
	})
	watchCountry!: string;

	@ApiProperty({
		description:
			"AT URI of the publication new reviews point at, or null for the opnshelf default",
		nullable: true,
		type: String,
	})
	reviewsPublicationUri!: string | null;

	@ApiProperty({
		description: "Cached display name of the chosen reviews publication",
		nullable: true,
		type: String,
	})
	reviewsPublicationName!: string | null;

	@ApiProperty({
		description:
			"Explicit reader format used for blog mirrors; Markdown is the portable default",
		enum: ["markdown", "leaflet", "offprint", "pckt"],
	})
	reviewsMirrorFormat!: string;
}

export class UpdateUserProfileDto {
	@ApiProperty({
		description: "Display name shown in OpnShelf",
		required: false,
	})
	@IsString()
	@IsOptional()
	displayName?: string;

	@ApiProperty({
		description: "Whether to show Bluesky profile link on public profile",
		required: false,
	})
	@IsBoolean()
	@IsOptional()
	showBlueskyOnProfile?: boolean;

	@ApiProperty({
		description: "Whether to show Tangled profile link on public profile",
		required: false,
	})
	@IsBoolean()
	@IsOptional()
	showTangledOnProfile?: boolean;
}

export class UserProfileDto {
	@ApiProperty({
		description: "Display name shown in OpnShelf",
		nullable: true,
		type: String,
	})
	displayName!: string | null;

	@ApiProperty({
		description: "OpnShelf profile avatar URL",
		nullable: true,
		type: String,
	})
	avatar!: string | null;

	@ApiProperty({
		description: "Bluesky profile URL",
		nullable: true,
		type: String,
	})
	blueskyProfileUrl!: string | null;

	@ApiProperty({
		description: "Tangled profile URL",
		nullable: true,
		type: String,
	})
	tangledProfileUrl!: string | null;

	@ApiProperty({
		description: "Whether Bluesky link is shown on public profile",
	})
	showBlueskyOnProfile!: boolean;

	@ApiProperty({
		description: "Whether Tangled link is shown on public profile",
	})
	showTangledOnProfile!: boolean;
}

export class ProfileActivityDayDto {
	@ApiProperty({
		description: "UTC calendar day in YYYY-MM-DD form",
	})
	date!: string;

	@ApiProperty({
		description: "Number of items watched on this day (rewatches included)",
	})
	count!: number;
}

export class MostWatchedShowDto {
	@ApiProperty({
		description: "TMDB show ID",
	})
	showId!: string;

	@ApiProperty({
		description: "Show title",
	})
	title!: string;

	@ApiProperty({
		description: "TMDB poster path",
		nullable: true,
		type: String,
	})
	posterPath!: string | null;

	@ApiProperty({
		description:
			"Number of logged episode watches for this show in the past 30 days (rewatches included)",
	})
	episodeWatchCount!: number;
}

export class PublicUserProfileDto {
	@ApiProperty({
		description: "Stable DID for the user",
	})
	did!: string;

	@ApiProperty({
		description: "AT Protocol handle",
	})
	handle!: string;

	@ApiProperty({
		description: "Display name shown in OpnShelf",
		nullable: true,
		type: String,
	})
	displayName!: string | null;

	@ApiProperty({
		description: "OpnShelf profile avatar URL",
		nullable: true,
		type: String,
	})
	avatar!: string | null;

	@ApiProperty({
		description: "Bluesky profile URL",
		nullable: true,
		type: String,
	})
	blueskyProfileUrl!: string | null;

	@ApiProperty({
		description: "Tangled profile URL",
		nullable: true,
		type: String,
	})
	tangledProfileUrl!: string | null;

	@ApiProperty({
		description: "Whether Bluesky link is shown on public profile",
	})
	showBlueskyOnProfile!: boolean;

	@ApiProperty({
		description: "Whether Tangled link is shown on public profile",
	})
	showTangledOnProfile!: boolean;

	@ApiProperty({
		description: "Public follower count",
	})
	followersCount!: number;

	@ApiProperty({
		description: "Public following count",
	})
	followingCount!: number;

	@ApiProperty({
		description:
			"Daily watch activity for the last 30 UTC days, oldest first (always 30 entries)",
		type: [ProfileActivityDayDto],
	})
	activityLast30Days!: ProfileActivityDayDto[];

	@ApiProperty({
		description:
			"The show with the most logged episode watches in the past 30 days, or null if none tracked",
		nullable: true,
		type: MostWatchedShowDto,
	})
	mostWatchedShow!: MostWatchedShowDto | null;

	@ApiProperty({
		description:
			"Items watched (movies + episodes) so far this calendar year, UTC",
	})
	watchedThisYear!: number;

	@ApiProperty({
		description: "Total number of reviews the user has written",
	})
	reviewsCount!: number;
}
