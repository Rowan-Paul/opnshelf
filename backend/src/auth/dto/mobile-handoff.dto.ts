import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";

/** base64url of 32 random bytes: exactly 43 characters, no padding. */
export const BASE64URL_32_BYTES = /^[A-Za-z0-9_-]{43}$/;

export class MobileHandoffChallengeResponseDto {
	@ApiProperty({
		description:
			"Secret the app keeps for itself and presents at the exchange. Never put it in a URL.",
	})
	codeVerifier: string;

	@ApiProperty({
		description:
			"S256 hash of the verifier. Append it as code_challenge to the login or signup URL, or send it as codeChallenge when starting a permission change.",
	})
	codeChallenge: string;

	@ApiProperty({
		description:
			"Advisory: start the OAuth flow before this time or request a new pair.",
	})
	expiresAt: string;
}

export class MobileHandoffExchangeDto {
	@ApiProperty({
		description: "The single-use code from the opnshelf://auth/complete link",
	})
	@IsString()
	@MinLength(1)
	@MaxLength(128)
	code: string;

	@ApiProperty({
		description: "The verifier issued with the challenge that started the flow",
	})
	@IsString()
	@Matches(BASE64URL_32_BYTES)
	codeVerifier: string;
}

export class MobileHandoffExchangeResponseDto {
	@ApiProperty({ description: "Opaque session id to use as the Bearer token" })
	sessionId: string;

	@ApiProperty()
	did: string;

	@ApiProperty()
	handle: string;
}
