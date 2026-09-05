import {
	BadRequestException,
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import {
	PermissionChangeDto,
	PermissionChangeResponseDto,
} from "./dto/permission-change.dto";
import type { OAuthScopePreferences } from "./oauth-scopes";
import type { AuthenticatedRequest } from "./types";

/**
 * Starting an External Integration Access change (ADR 0030). The change
 * completes in AuthController's OAuth callback, which applies the granted set
 * account-wide. The route keeps its `AuthController_*` operationId: the
 * generated client names its function after it, so moving the route must not
 * rename it.
 */
@ApiTags("auth")
@Controller()
export class PermissionsController {
	constructor(private readonly authService: AuthService) {}

	/** Explicitly request (or remove) one external integration's cumulative scope. */
	@Post("auth/permissions")
	@HttpCode(HttpStatus.OK)
	@UseGuards(AuthGuard)
	@ApiOperation({
		operationId: "AuthController_permissions",
		summary: "Start an account-wide external integration permission change",
	})
	@ApiResponse({ status: 200, type: PermissionChangeResponseDto })
	async permissions(
		@Req() req: AuthenticatedRequest,
		@Body() dto: PermissionChangeDto,
	): Promise<PermissionChangeResponseDto> {
		const did = req.user?.did;
		if (!did) throw new BadRequestException("User not found in request");
		const { integration, action, platform, codeChallenge } = dto;
		const enable = action === "connect";
		const user = await this.authService.getUser(did);
		if (!user) throw new BadRequestException("User not found");
		if (enable && integration === "blog" && !user.reviewsPublicationUri) {
			throw new BadRequestException(
				"Choose a public publication before connecting blog mirroring",
			);
		}
		if (enable && integration === "bluesky") {
			const hasProfile = await this.authService.hasBlueskyProfile(
				req.user.session as { did: string } | undefined,
			);
			if (!hasProfile) {
				throw new BadRequestException(
					"A public Bluesky profile is required before connecting Cross-posts",
				);
			}
		}
		const preferences: OAuthScopePreferences = {
			...(integration === "atstore" ? { atStoreReviewEnabled: enable } : {}),
			blogEnabled:
				integration === "blog" ? enable : user.blogIntegrationEnabled,
			blueskyEnabled:
				integration === "bluesky" ? enable : user.blueskyCrossPostEnabled,
			reviewsMirrorFormat: user.reviewsMirrorFormat,
		};
		const authorizationUrl = platform
			? await this.authService.authorizePermissionChange(
					user.handle,
					integration,
					preferences,
					{ platform, codeChallenge },
				)
			: await this.authService.authorizePermissionChange(
					user.handle,
					integration,
					preferences,
				);
		return { authorizationUrl };
	}
}
