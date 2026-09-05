import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional, Matches } from "class-validator";

export const OAUTH_INTEGRATIONS = ["atstore", "blog", "bluesky"] as const;
export const OAUTH_PERMISSION_ACTIONS = ["connect", "disconnect"] as const;
export const OAUTH_PERMISSION_PLATFORMS = ["mobile"] as const;

export type OAuthIntegrationInput = (typeof OAUTH_INTEGRATIONS)[number];
export type OAuthPermissionAction = (typeof OAUTH_PERMISSION_ACTIONS)[number];

export class PermissionChangeDto {
	@ApiProperty({ enum: OAUTH_INTEGRATIONS })
	@IsIn(OAUTH_INTEGRATIONS)
	integration: OAuthIntegrationInput;

	@ApiProperty({ enum: OAUTH_PERMISSION_ACTIONS })
	@IsIn(OAUTH_PERMISSION_ACTIONS)
	action: OAuthPermissionAction;

	@ApiProperty({ enum: OAUTH_PERMISSION_PLATFORMS, required: false })
	@IsOptional()
	@IsIn(OAUTH_PERMISSION_PLATFORMS)
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

export class PermissionChangeResponseDto {
	@ApiProperty({
		description: "Authorization URL for the cumulative OAuth permission set",
	})
	authorizationUrl: string;
}
