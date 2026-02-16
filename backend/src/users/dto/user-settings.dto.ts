import { ApiProperty } from "@nestjs/swagger";
import {
	IsBoolean,
	IsHexColor,
	IsIn,
	IsOptional,
	IsString,
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
		description: "Accent color for theming (hex format, e.g., #F59E0B)",
		required: false,
	})
	@IsString()
	@IsOptional()
	@IsHexColor()
	accentColor?: string;
}

export class DeleteUserAccountDto {
	@ApiProperty({
		description:
			"Whether to delete the user's watch history from their PDS. If false, the data remains on their PDS.",
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

	@ApiProperty({
		description: "Accent color for theming (hex format, e.g., #F59E0B)",
	})
	accentColor!: string;
}
