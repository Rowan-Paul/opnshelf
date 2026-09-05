import { ApiProperty } from "@nestjs/swagger";
import {
	IsIn,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
	MinLength,
} from "class-validator";

export class VerifyEmailDto {
	@ApiProperty({
		description: "The verification code from the signup email",
	})
	@IsString()
	@MinLength(1)
	@MaxLength(512)
	code: string;

	@ApiProperty({
		enum: ["mobile"],
		required: false,
		description:
			'Platform identifier ("mobile") so the Core OAuth callback redirects into the app',
	})
	@IsOptional()
	@IsIn(["mobile"])
	platform?: "mobile";

	@ApiProperty({
		required: false,
		description:
			"S256 challenge from POST /auth/mobile/challenge. Mobile only: the callback then hands the app a single-use code instead of the session id.",
	})
	@IsOptional()
	@Matches(/^[A-Za-z0-9_-]{43}$/)
	codeChallenge?: string;
}

export class VerifyEmailResponseDto {
	@ApiProperty({ description: "Whether the account is now verified" })
	verified: boolean;

	@ApiProperty({
		description:
			"Core OAuth authorization URL. The bootstrap credential is revoked before this is returned.",
	})
	coreOAuthUrl: string;
}
