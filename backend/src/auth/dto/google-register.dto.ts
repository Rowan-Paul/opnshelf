import { ApiProperty, OmitType } from "@nestjs/swagger";
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
] as const) {}

export class GoogleRegisterResponseDto {
	@ApiProperty()
	did: string;

	@ApiProperty()
	handle: string;

	@ApiProperty({
		description:
			"Where to send the browser next: the PDS authorization page that grants opnshelf its scopes and triggers seeding",
	})
	coreOAuthUrl: string;
}
