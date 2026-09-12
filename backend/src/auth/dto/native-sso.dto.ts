import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	IsIn,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
} from "class-validator";
import type { OAuthAppState } from "../oauth-app-state";
import { BASE64URL_32_BYTES } from "./mobile-handoff.dto";

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

	@ApiProperty({
		enum: ["mobile"],
		required: false,
		description:
			'Platform identifier ("mobile") so the Core OAuth callback redirects into the Mobile App',
	})
	@IsOptional()
	@IsIn(["mobile"])
	platform?: "mobile";

	@ApiProperty({
		required: false,
		description:
			"S256 challenge from POST /auth/mobile/challenge. Mobile only: the callback then hands the Mobile App a single-use code instead of the session id.",
	})
	@IsOptional()
	@IsString()
	@Matches(BASE64URL_32_BYTES)
	codeChallenge?: string;
}

/**
 * The OAuth app state a native sign-in has to create its authorization request
 * with. Undefined for anything that is not the Mobile App, which is how the
 * callback tells a native flow from a web one.
 *
 * Without this the request carries no platform, the callback reads the flow as
 * web, and the Mobile App is left on the Web App's onboarding page with a live
 * account and no session (ADR 0026).
 */
export function nativeSsoAppState(
	dto: NativeSsoDto,
): OAuthAppState | undefined {
	if (dto.platform !== "mobile") return undefined;
	return { platform: "mobile", codeChallenge: dto.codeChallenge };
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
