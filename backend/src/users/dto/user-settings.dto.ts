import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";

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
