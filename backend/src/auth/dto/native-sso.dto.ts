import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

/**
 * A credential the operating system produced, handed straight to us by the
 * Mobile App. There is no browser round trip and so no state to verify: the
 * token's own signature is the proof, and the PDS is what checks it.
 */
export class NativeSsoDto {
	@ApiProperty({
		description: "The identity token the platform's sign-in API returned",
	})
	@IsString()
	@MaxLength(8192)
	identityToken: string;
}

export class NativeSsoResponseDto {
	@ApiPropertyOptional({
		description:
			"Set for a returning user: open this in a browser to finish authorizing. Absent for a new user.",
	})
	redirectUrl?: string;

	@ApiPropertyOptional({
		description:
			"Set for a new user: hand to the native handle picker, then send back with the registration. Absent for a returning user.",
	})
	pendingToken?: string;

	@ApiPropertyOptional({
		description:
			"Set for a new user: the address the provider verified, shown on the handle picker.",
	})
	email?: string;
}
