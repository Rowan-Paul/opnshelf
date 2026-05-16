import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";

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
}

export class UpdateUserProfileDto {
	@ApiProperty({
		description: "Display name shown in OpnShelf",
		required: false,
	})
	@IsString()
	@IsOptional()
	displayName?: string;
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
		description: "Public follower count",
	})
	followersCount!: number;

	@ApiProperty({
		description: "Public following count",
	})
	followingCount!: number;
}
