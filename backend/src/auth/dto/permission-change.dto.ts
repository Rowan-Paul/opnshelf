import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

export const OAUTH_INTEGRATIONS = ["blog", "bluesky"] as const;
export const OAUTH_PERMISSION_ACTIONS = ["connect", "disconnect"] as const;

export type OAuthIntegrationInput = (typeof OAUTH_INTEGRATIONS)[number];
export type OAuthPermissionAction = (typeof OAUTH_PERMISSION_ACTIONS)[number];

export class PermissionChangeDto {
	@ApiProperty({ enum: OAUTH_INTEGRATIONS })
	@IsIn(OAUTH_INTEGRATIONS)
	integration: OAuthIntegrationInput;

	@ApiProperty({ enum: OAUTH_PERMISSION_ACTIONS })
	@IsIn(OAUTH_PERMISSION_ACTIONS)
	action: OAuthPermissionAction;
}

export class PermissionChangeResponseDto {
	@ApiProperty({
		description: "Authorization URL for the cumulative OAuth permission set",
	})
	authorizationUrl: string;
}
