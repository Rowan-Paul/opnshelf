import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type {
	UpdateUserSettingsDto,
	UserSettingsDto,
} from "./dto/user-settings.dto";

@Injectable()
export class UsersService {
	private readonly logger = new Logger(UsersService.name);

	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Get user settings by DID
	 */
	async getUserSettings(did: string): Promise<UserSettingsDto> {
		const user = await this.prisma.user.findUnique({
			where: { did },
			select: {
				timezone: true,
				timeFormat: true,
			},
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		return {
			timezone: user.timezone,
			timeFormat: user.timeFormat,
		};
	}

	/**
	 * Update user settings
	 */
	async updateUserSettings(
		did: string,
		dto: UpdateUserSettingsDto,
	): Promise<UserSettingsDto> {
		const user = await this.prisma.user.findUnique({
			where: { did },
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		const updatedUser = await this.prisma.user.update({
			where: { did },
			data: {
				...(dto.timezone !== undefined && { timezone: dto.timezone }),
				...(dto.timeFormat !== undefined && { timeFormat: dto.timeFormat }),
			},
			select: {
				timezone: true,
				timeFormat: true,
			},
		});

		this.logger.log(`Updated settings for user ${did}`);

		return {
			timezone: updatedUser.timezone,
			timeFormat: updatedUser.timeFormat,
		};
	}
}
