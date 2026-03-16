import { ApiProperty } from "@nestjs/swagger";
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
	})
	displayName!: string | null;

	@ApiProperty({
		description: "Avatar URL imported from BlueSky",
		nullable: true,
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
	})
	displayName!: string | null;

	@ApiProperty({
		description: "Avatar URL imported from BlueSky",
		nullable: true,
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
