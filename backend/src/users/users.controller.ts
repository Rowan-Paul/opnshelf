import {
	Body,
	BadRequestException,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Query,
	Param,
	Patch,
	Post,
	Req,
	Res,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common";
import {
	ApiBody,
	ApiConsumes,
	ApiOperation,
	ApiQuery,
	ApiResponse,
	ApiTags,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { OptionalAuthGuard } from "../auth/optional-auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import {
	CompleteOnboardingResponseDto,
	ImportBlueskyFollowsResponseDto,
} from "./dto/import-history.dto";
import {
	AccountDeletionJobDto,
	DeleteUserAccountDto,
	PublicUserProfileDto,
	UpdateUserProfileDto,
	UpdateUserSettingsDto,
	UserProfileDto,
	UserSettingsDto,
} from "./dto/user-settings.dto";
import { parseAccountDeletionData } from "./background-job-data";
import { UsersService } from "./users.service";
import { SocialService } from "../social/social.service";
import type { ATSession } from "../movies/movies.service";
import {
	SocialPaginationQueryDto,
	PaginatedSocialUsersDto,
} from "../social/dto/social.dto";
import { MAX_AVATAR_BYTES } from "./avatar.constants";

// `files` and `fields` enforce the real constraint: one file, no text fields.
// `parts` is a busboy backstop, and busboy counts the closing boundary as a
// part transition, so `parts: N` rejects a body with exactly N parts. A
// single-part avatar upload therefore needs `parts: 2`, not `parts: 1`.
// Covered by users.controller.avatar.spec.ts.
const AVATAR_MULTIPART_LIMITS = {
	fileSize: MAX_AVATAR_BYTES,
	files: 1,
	fields: 0,
	parts: 2,
	fieldNestingDepth: 1,
};

@ApiTags("users")
@Controller("users")
export class UsersController {
	constructor(
		private readonly usersService: UsersService,
		private readonly socialService: SocialService,
	) {}

	@Get(":handle/profile")
	@UseGuards(OptionalAuthGuard)
	@ApiOperation({ summary: "Get a public user profile by handle" })
	@ApiResponse({ status: 200, type: PublicUserProfileDto })
	@ApiResponse({ status: 404, description: "User not found" })
	async getPublicProfile(
		@Param("handle") handle: string,
		@Req() req: Request,
	): Promise<PublicUserProfileDto> {
		return this.usersService.getPublicProfileByHandle(
			handle,
			(req as AuthenticatedRequest).user?.did,
		);
	}

	@Get(":handle/followers")
	@UseGuards(OptionalAuthGuard)
	@ApiOperation({ summary: "Get public followers for a user by handle" })
	@ApiResponse({ status: 200, type: PaginatedSocialUsersDto })
	@ApiResponse({ status: 404, description: "User not found" })
	async getPublicFollowers(
		@Param("handle") handle: string,
		@Query() query: SocialPaginationQueryDto,
		@Req() req: Request,
	): Promise<PaginatedSocialUsersDto> {
		const viewerDid = (req as AuthenticatedRequest).user?.did ?? null;
		return this.socialService.getFollowers(
			viewerDid,
			handle,
			query.page ?? 1,
			query.pageSize ?? 20,
		);
	}

	@Get(":handle/following")
	@UseGuards(OptionalAuthGuard)
	@ApiOperation({ summary: "Get public following for a user by handle" })
	@ApiResponse({ status: 200, type: PaginatedSocialUsersDto })
	@ApiResponse({ status: 404, description: "User not found" })
	async getPublicFollowing(
		@Param("handle") handle: string,
		@Query() query: SocialPaginationQueryDto,
		@Req() req: Request,
	): Promise<PaginatedSocialUsersDto> {
		const viewerDid = (req as AuthenticatedRequest).user?.did ?? null;
		return this.socialService.getFollowing(
			viewerDid,
			handle,
			query.page ?? 1,
			query.pageSize ?? 20,
		);
	}

	@Get("avatar")
	@ApiOperation({ summary: "Get a public user avatar from the user's PDS" })
	@ApiQuery({ name: "did", required: true, description: "User DID" })
	@ApiQuery({ name: "cid", required: true, description: "Blob CID" })
	@ApiResponse({ status: 200, description: "Avatar image bytes" })
	async getAvatar(
		@Query("did") did: string,
		@Query("cid") cid: string,
		@Res() res: Response,
	): Promise<void> {
		await this.usersService.streamUserAvatar(did, cid, res);
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

		return this.usersService.getUserSettings(
			did,
			req.user.session as ATSession,
		);
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

		const session = req.user?.session as ATSession | undefined;
		return this.usersService.updateUserSettings(did, dto, session);
	}

	@Delete("me/settings/private")
	@UseGuards(AuthGuard)
	@ApiOperation({
		summary:
			"Delete the private settings record while retaining the last local preference",
	})
	@ApiResponse({ status: 200, description: "Private record deleted" })
	async deletePrivateSettings(@Req() req: AuthenticatedRequest): Promise<void> {
		await this.usersService.deletePrivateSettings(
			req.user.did,
			req.user.session as ATSession,
		);
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

		const session = req.user?.session as ATSession | undefined;
		if (!session || !session.did) {
			throw new BadRequestException("Session not found in request");
		}

		return this.usersService.updateUserProfile(did, session, dto);
	}

	@Post("me/profile/avatar")
	@UseGuards(AuthGuard)
	@UseInterceptors(
		FileInterceptor("avatar", {
			limits: AVATAR_MULTIPART_LIMITS,
		}),
	)
	@ApiConsumes("multipart/form-data")
	@ApiBody({
		schema: {
			type: "object",
			required: ["avatar"],
			properties: {
				avatar: {
					type: "string",
					format: "binary",
				},
			},
		},
	})
	@ApiOperation({ summary: "Upload current user's profile avatar" })
	@ApiResponse({ status: 200, type: UserProfileDto })
	async uploadMyAvatar(
		@UploadedFile()
		file:
			| {
					buffer: Buffer;
					mimetype: string;
					size: number;
			  }
			| undefined,
		@Req() req: AuthenticatedRequest,
	): Promise<UserProfileDto> {
		const did = req.user?.did;
		if (!did) {
			throw new BadRequestException("User not found in request");
		}

		const session = req.user?.session as ATSession | undefined;
		if (!session || !session.did) {
			throw new BadRequestException("Session not found in request");
		}

		if (!file) {
			throw new BadRequestException("Avatar file is required");
		}

		return this.usersService.uploadUserAvatar(did, session, file);
	}

	@Delete("me/profile/avatar")
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Delete current user's profile avatar" })
	@ApiResponse({ status: 200, type: UserProfileDto })
	async deleteMyAvatar(
		@Req() req: AuthenticatedRequest,
	): Promise<UserProfileDto> {
		const did = req.user?.did;
		if (!did) {
			throw new BadRequestException("User not found in request");
		}

		const session = req.user?.session as ATSession | undefined;
		if (!session || !session.did) {
			throw new BadRequestException("Session not found in request");
		}

		return this.usersService.deleteUserAvatar(did, session);
	}

	@Post("me/profile/refresh-social-links")
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Refresh discovered social profile links from PDS" })
	@ApiResponse({ status: 200, type: UserProfileDto })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async refreshMySocialLinks(
		@Req() req: AuthenticatedRequest,
	): Promise<UserProfileDto> {
		const did = req.user?.did;
		if (!did) {
			throw new BadRequestException("User not found in request");
		}

		const handle = await this.usersService.getUserHandle(did);
		return this.usersService.refreshSocialProfiles(did, handle);
	}

	@Delete("me/account")
	@UseGuards(AuthGuard)
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Delete current user's account" })
	@ApiResponse({
		status: 200,
		type: AccountDeletionJobDto,
		description: "PDS deletion requested; returns a job to poll for progress",
	})
	@ApiResponse({
		status: 204,
		description: "Account deleted immediately (no PDS deletion)",
	})
	@ApiResponse({ status: 401, description: "Not authenticated" })
	@ApiResponse({
		status: 409,
		description: "Account deletion already in progress",
	})
	async deleteMyAccount(
		@Body() dto: DeleteUserAccountDto,
		@Req() req: AuthenticatedRequest,
		@Res({ passthrough: true }) res: Response,
	): Promise<AccountDeletionJobDto | undefined> {
		const did = req.user?.did;
		if (!did) {
			throw new BadRequestException("User not found in request");
		}

		const deletePDSData = dto.deletePDSData ?? false;

		if (!deletePDSData) {
			await this.usersService.deleteUserSync(did);
			res.status(HttpStatus.NO_CONTENT);
			return;
		}

		const job = await this.usersService.createDeletionJob(did, true);
		const jobData = parseAccountDeletionData(job.data);

		res.status(HttpStatus.OK);
		return {
			id: job.id,
			status: job.status,
			totalRecords: jobData.totalRecords,
			deletedRecords: jobData.deletedRecords,
			currentStep: jobData.currentStep,
			lastError: job.lastError ?? undefined,
			createdAt: job.createdAt.toISOString(),
		};
	}

	@Get("me/account-deletion")
	@UseGuards(AuthGuard)
	@ApiOperation({ summary: "Get current account deletion job status" })
	@ApiResponse({
		status: 200,
		type: AccountDeletionJobDto,
		description:
			"Current or most recent account deletion job, or null when none exists",
	})
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async getMyAccountDeletion(
		@Req() req: AuthenticatedRequest,
	): Promise<AccountDeletionJobDto | null> {
		const did = req.user?.did;
		if (!did) {
			throw new BadRequestException("User not found in request");
		}

		const job = await this.usersService.getCurrentDeletionJob(did);
		if (!job) {
			return null;
		}

		const jobData = parseAccountDeletionData(job.data);
		return {
			id: job.id,
			status: job.status,
			totalRecords: jobData.totalRecords,
			deletedRecords: jobData.deletedRecords,
			currentStep: jobData.currentStep,
			lastError: job.lastError ?? undefined,
			createdAt: job.createdAt.toISOString(),
		};
	}

	@Post("me/onboarding/reset")
	@UseGuards(AuthGuard)
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary:
			"Reset onboarding for the current user without removing their data",
	})
	@ApiResponse({ status: 204, description: "Onboarding reset" })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async resetOnboarding(@Req() req: AuthenticatedRequest): Promise<void> {
		const did = req.user?.did;
		if (!did) throw new BadRequestException("User not found in request");
		await this.usersService.resetOnboarding(did);
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

	@Post("me/import/bluesky-follows")
	@UseGuards(AuthGuard)
	@ApiOperation({
		summary: "Import Bluesky follows that already have Opnshelf accounts",
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
}
