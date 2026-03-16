import {
	Body,
	BadRequestException,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import {
	CompleteOnboardingResponseDto,
	FetchTraktPublicHistoryDto,
	FetchTraktPublicHistoryResponseDto,
	ImportBlueskyFollowsResponseDto,
	ImportHistoryDto,
	ImportHistoryResponseDto,
} from "./dto/import-history.dto";
import {
	DeleteUserAccountDto,
	PublicUserProfileDto,
	UpdateUserProfileDto,
	UpdateUserSettingsDto,
	UserProfileDto,
	UserSettingsDto,
} from "./dto/user-settings.dto";
import { UsersService } from "./users.service";
import type { ATSession } from "../movies/movies.service";

@ApiTags("users")
@Controller("users")
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Get(":handle/profile")
	@ApiOperation({ summary: "Get a public user profile by handle" })
	@ApiResponse({ status: 200, type: PublicUserProfileDto })
	@ApiResponse({ status: 404, description: "User not found" })
	async getPublicProfile(
		@Param("handle") handle: string,
	): Promise<PublicUserProfileDto> {
		return this.usersService.getPublicProfileByHandle(handle);
	}

	/**
	 * Get current user's settings
	 */
	@Get("me/settings")
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Get current user's settings" })
	@ApiResponse({ status: 200, type: UserSettingsDto })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async getMySettings(
		@Req() req: AuthenticatedRequest,
	): Promise<UserSettingsDto> {
		const did = req.user?.did;
		if (!did) {
			throw new Error("User not found in request");
		}

		return this.usersService.getUserSettings(did);
	}

	/**
	 * Update current user's settings
	 */
	@Patch("me/settings")
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Update current user's settings" })
	@ApiResponse({ status: 200, type: UserSettingsDto })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async updateMySettings(
		@Body() dto: UpdateUserSettingsDto,
		@Req() req: AuthenticatedRequest,
	): Promise<UserSettingsDto> {
		const did = req.user?.did;
		if (!did) {
			throw new Error("User not found in request");
		}

		return this.usersService.updateUserSettings(did, dto);
	}

	/**
	 * Update current user's profile details
	 */
	@Patch("me/profile")
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Update current user's profile" })
	@ApiResponse({ status: 200, type: UserProfileDto })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async updateMyProfile(
		@Body() dto: UpdateUserProfileDto,
		@Req() req: AuthenticatedRequest,
	): Promise<UserProfileDto> {
		const did = req.user?.did;
		if (!did) {
			throw new Error("User not found in request");
		}

		return this.usersService.updateUserProfile(did, dto);
	}

	/**
	 * Delete current user's account
	 */
	@Delete("me/account")
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Delete current user's account" })
	@ApiResponse({ status: 204, description: "Account deleted successfully" })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async deleteMyAccount(
		@Body() dto: DeleteUserAccountDto,
		@Req() req: AuthenticatedRequest,
	): Promise<void> {
		const did = req.user?.did;
		if (!did) {
			throw new Error("User not found in request");
		}

		const session = req.user?.session as ATSession | undefined;
		if (!session || !session.did) {
			throw new Error("Session not found in request");
		}

		await this.usersService.deleteUser(
			did,
			session,
			dto.deletePDSData ?? false,
		);
	}

	@Post("me/onboarding/complete")
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Complete onboarding for the current user" })
	@ApiResponse({ status: 200, type: CompleteOnboardingResponseDto })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async completeOnboarding(
		@Req() req: AuthenticatedRequest,
	): Promise<CompleteOnboardingResponseDto> {
		const did = req.user?.did;
		if (!did) {
			throw new BadRequestException("User not found in request");
		}

		return this.usersService.completeOnboarding(did);
	}

	@Post("me/import/trakt/public/fetch")
	@UseGuards(AuthGuard)
	@ApiOperation({
		summary: "Fetch normalized history from a public Trakt profile",
	})
	@ApiResponse({ status: 200, type: FetchTraktPublicHistoryResponseDto })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async fetchMyTraktPublicHistory(
		@Body() dto: FetchTraktPublicHistoryDto,
	): Promise<FetchTraktPublicHistoryResponseDto> {
		return this.usersService.fetchTraktPublicHistory(
			dto.username,
			dto.maxItems,
		);
	}

	@Post("me/import/bluesky-follows")
	@UseGuards(AuthGuard)
	@ApiOperation({
		summary: "Import Bluesky follows that already have OpnShelf accounts",
	})
	@ApiResponse({ status: 200, type: ImportBlueskyFollowsResponseDto })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async importMyBlueskyFollows(
		@Req() req: AuthenticatedRequest,
	): Promise<ImportBlueskyFollowsResponseDto> {
		const did = req.user?.did;
		if (!did) {
			throw new BadRequestException("User not found in request");
		}

		return this.usersService.importBlueskyFollows(did);
	}

	@Post("me/import/history")
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Import normalized watch history items" })
	@ApiResponse({ status: 200, type: ImportHistoryResponseDto })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async importMyHistory(
		@Body() dto: ImportHistoryDto,
		@Req() req: AuthenticatedRequest,
	): Promise<ImportHistoryResponseDto> {
		const did = req.user?.did;
		if (!did) {
			throw new BadRequestException("User not found in request");
		}

		const session = req.user?.session as ATSession | undefined;
		if (!session || !session.did) {
			throw new BadRequestException("Session not found in request");
		}

		return this.usersService.importNormalizedItems(did, session, dto.items);
	}
}
