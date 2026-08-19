import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	IsEmail,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
	MinLength,
} from "class-validator";

export class RegisterDto {
	@ApiProperty({
		description:
			"Desired username (the subdomain label). Combined with the PDS handle domain, e.g. 'jane' -> jane.opnshelf.social",
		example: "jane",
	})
	@IsString()
	@MinLength(3)
	@MaxLength(63)
	// DNS label: alphanumeric and hyphens, not starting/ending with a hyphen.
	@Matches(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{1,61}[a-zA-Z0-9])?$/, {
		message:
			"Username must be 3-63 characters, letters/numbers/hyphens only, and cannot start or end with a hyphen",
	})
	username: string;

	@ApiProperty({ description: "Email for the new PDS account" })
	@IsEmail()
	@MaxLength(254)
	email: string;

	@ApiProperty({
		description: "Password for the new PDS account",
		minLength: 8,
	})
	@IsString()
	@MinLength(8)
	@MaxLength(256)
	password: string;

	@ApiProperty({
		description: "Cloudflare Turnstile token proving the request is human",
	})
	@IsString()
	@MaxLength(4096)
	captchaToken: string;

	@ApiPropertyOptional({
		description: "User's IANA timezone, e.g. Europe/Amsterdam",
	})
	@IsOptional()
	@IsString()
	@MaxLength(64)
	timezone?: string;
}

export class RegisterResponseDto {
	@ApiProperty()
	did: string;

	@ApiProperty()
	handle: string;

	@ApiProperty({
		description: "Opaque session id (also set as an httpOnly cookie)",
	})
	sessionId: string;
}
