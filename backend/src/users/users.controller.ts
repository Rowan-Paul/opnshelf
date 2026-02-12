import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import {
	UpdateUserSettingsDto,
	UserSettingsDto,
} from "./dto/user-settings.dto";
import { UsersService } from "./users.service";

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
}
