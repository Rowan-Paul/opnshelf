import { ApiProperty, ApiPropertyOptional, OmitType } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { RegisterDto } from "./register.dto";

/**
 * Google signup carries no email or password: the email comes from the verified
 * `id_token` held server-side, and an SSO account has no password. Everything
 * else (the username rules above all) is shared with password signup so handle
 * validation never forks in two.
 */
export class GoogleRegisterDto extends OmitType(RegisterDto, [
	"email",
	"password",
] as const) {
	/**
	 * Native clients hold the pending registration themselves — they have no
	 * cookie jar — and send it back here. The browser flow leaves this unset and
	 * the `google_pending` cookie is used instead.
	 */
	@ApiPropertyOptional({
		description:
			"Pending registration token, for native clients that cannot use a cookie",
	})
	@IsOptional()
	@IsString()
	@MaxLength(512)
	pendingToken?: string;
}

export class GoogleRegisterResponseDto {
	@ApiProperty()
	did: string;

	@ApiProperty()
	handle: string;

	@ApiProperty({
		description:
			"Where to send the browser next: the PDS consent page for the OAuth request bound to this registration",
	})
	coreOAuthUrl: string;
}

export class GooglePendingResponseDto {
	@ApiProperty({
		description: "Email verified by Google for the pending signup",
	})
	email: string;
}
