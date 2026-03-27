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
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import {
	CompleteOnboardingResponseDto,
	FetchTraktPublicHistoryDto,
	FetchTraktPublicHistoryResponseDto,
	ImportBlueskyFollowsResponseDto,
	ImportHistoryDto,
	ImportHistoryResponseDto,
	StartTraktImportDto,
	StartTraktImportResponseDto,
	TraktImportJobDto,
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

		const session = req.user?.session as ATSession | undefined;
		if (!session || !session.did) {
			throw new BadRequestException("Session not found in request");
		}

		return this.usersService.updateUserProfile(did, session, dto);
	}

	@Post("me/profile/avatar")
	@UseGuards(AuthGuard)
	@UseInterceptors(FileInterceptor("avatar"))
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

	@Post("me/import/trakt/public/start")
	@UseGuards(AuthGuard)
	@ApiOperation({
		summary: "Start a background import for a public Trakt profile",
	})
	@ApiResponse({ status: 200, type: StartTraktImportResponseDto })
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async startMyTraktImport(
		@Body() dto: StartTraktImportDto,
		@Req() req: AuthenticatedRequest,
	): Promise<StartTraktImportResponseDto> {
		const did = req.user?.did;
		if (!did) {
			throw new BadRequestException("User not found in request");
		}

		return this.usersService.startTraktImport(did, dto.username);
	}

	@Get("me/import/trakt/public/current")
	@UseGuards(AuthGuard)
	@ApiOperation({
		summary:
			"Get the current or most recent background Trakt import for the current user",
	})
	@ApiResponse({
		status: 200,
		type: TraktImportJobDto,
		description: "Current or recent Trakt import job, or null when none exists",
	})
	@ApiResponse({ status: 401, description: "Not authenticated" })
	async getMyCurrentTraktImport(
		@Req() req: AuthenticatedRequest,
	): Promise<TraktImportJobDto | null> {
		const did = req.user?.did;
		if (!did) {
			throw new BadRequestException("User not found in request");
		}

		return this.usersService.getCurrentTraktImport(did);
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
