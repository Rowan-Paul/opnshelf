import {
	Body,
	Controller,
	Delete,
	Get,
	Patch,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import {
	DeleteUserAccountDto,
	UpdateUserSettingsDto,
	UserSettingsDto,
} from "./dto/user-settings.dto";
import { UsersService } from "./users.service";
import type { ATSession } from "../movies/movies.service";

@ApiTags("users")
@Controller("users")
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

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
}
