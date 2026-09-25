import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	IsBoolean,
	IsEmail,
	IsIn,
	IsOptional,
	IsString,
	Matches,
} from "class-validator";

export class NotificationSettingsDto {
	@ApiPropertyOptional({ nullable: true, type: String })
	email!: string | null;

	@ApiProperty()
	emailVerified!: boolean;

	@ApiProperty()
	pushDeviceCount!: number;

	@ApiProperty() pushNewReleases!: boolean;
	@ApiProperty() pushWatchlistReleases!: boolean;
	@ApiProperty() pushNewSeasons!: boolean;
	@ApiProperty() pushStats!: boolean;
	@ApiProperty() emailNewReleases!: boolean;
	@ApiProperty() emailWatchlistReleases!: boolean;
	@ApiProperty() emailNewSeasons!: boolean;
	@ApiProperty() emailStats!: boolean;
}

export class UpdateNotificationSettingsDto {
	@ApiPropertyOptional() @IsOptional() @IsBoolean() pushNewReleases?: boolean;
	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	pushWatchlistReleases?: boolean;
	@ApiPropertyOptional() @IsOptional() @IsBoolean() pushNewSeasons?: boolean;
	@ApiPropertyOptional() @IsOptional() @IsBoolean() pushStats?: boolean;
	@ApiPropertyOptional() @IsOptional() @IsBoolean() emailNewReleases?: boolean;
	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	emailWatchlistReleases?: boolean;
	@ApiPropertyOptional() @IsOptional() @IsBoolean() emailNewSeasons?: boolean;
	@ApiPropertyOptional() @IsOptional() @IsBoolean() emailStats?: boolean;
}

export class RequestNotificationEmailDto {
	@ApiProperty()
	@IsEmail()
	email!: string;
}

export class ConfirmNotificationEmailDto {
	@ApiProperty()
	@Matches(/^\d{6}$/)
	code!: string;
}

export class RegisterPushDeviceDto {
	@ApiProperty()
	@IsString()
	@Matches(/^ExponentPushToken\[[\w-]+\]$|^ExpoPushToken\[[\w-]+\]$/)
	token!: string;

	@ApiProperty({ enum: ["ios", "android"] })
	@IsIn(["ios", "android"])
	platform!: "ios" | "android";
}

export class RemovePushDeviceDto {
	@ApiProperty()
	@IsString()
	token!: string;
}

export class TestNotificationDto {
	@ApiProperty({ enum: ["push", "email"] })
	@IsIn(["push", "email"])
	channel!: "push" | "email";
}
