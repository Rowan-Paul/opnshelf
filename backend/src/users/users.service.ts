import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type {
	CompleteOnboardingResponseDto,
	FetchTraktPublicHistoryResponseDto,
	ImportHistoryResponseDto,
	NormalizedImportItemDto,
} from "./dto/import-history.dto";
import type {
	PublicUserProfileDto,
	UserProfileDto,
	UpdateUserSettingsDto,
	UpdateUserProfileDto,
	UserSettingsDto,
} from "./dto/user-settings.dto";
import { ImportHistoryService } from "./import-history.service";
import { UserDeletionService } from "./user-deletion.service";

interface ATSession {
	did: string;
}

@Injectable()
export class UsersService {
	private readonly logger = new Logger(UsersService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly importHistoryService: ImportHistoryService,
		private readonly userDeletionService: UserDeletionService,
	) {}

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

	async updateUserProfile(
		did: string,
		dto: UpdateUserProfileDto,
	): Promise<UserProfileDto> {
		const user = await this.prisma.user.findUnique({ where: { did } });

		if (!user) {
			throw new NotFoundException("User not found");
		}

		const updatedUser = await this.prisma.user.update({
			where: { did },
			data: {
				...(dto.displayName !== undefined && {
					displayName: dto.displayName.trim() || null,
				}),
			},
			select: {
				displayName: true,
				avatar: true,
			},
		});

		this.logger.log(`Updated profile for user ${did}`);

		return {
			displayName: updatedUser.displayName,
			avatar: updatedUser.avatar,
		};
	}

	async getPublicProfileByHandle(handle: string): Promise<PublicUserProfileDto> {
		const normalizedHandle = handle.trim().replace(/^@/, "").toLowerCase();
		const user = await this.prisma.user.findUnique({
			where: { handle: normalizedHandle },
			select: {
				did: true,
				handle: true,
				displayName: true,
				avatar: true,
			},
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		return user;
	}

	async completeOnboarding(
		did: string,
	): Promise<CompleteOnboardingResponseDto> {
		const user = await this.prisma.user.findUnique({ where: { did } });
		if (!user) {
			throw new NotFoundException("User not found");
		}

		const updated = await this.prisma.user.update({
			where: { did },
			data: {
				onboardingCompletedAt: new Date(),
			},
			select: {
				onboardingCompletedAt: true,
			},
		});

		return {
			onboardingCompletedAt:
				updated.onboardingCompletedAt?.toISOString() ??
				new Date().toISOString(),
			needsOnboarding: false,
		};
	}

	async fetchTraktPublicHistory(
		username: string,
		maxItems?: number,
	): Promise<FetchTraktPublicHistoryResponseDto> {
		return this.importHistoryService.fetchTraktPublicHistory(
			username,
			maxItems,
		);
	}

	async importNormalizedItems(
		userDid: string,
		session: ATSession,
		items: NormalizedImportItemDto[],
	): Promise<ImportHistoryResponseDto> {
		return this.importHistoryService.importNormalizedItems(
			userDid,
			session,
			items,
		);
	}

	/**
	 * Delete user account
	 * @param did - User's DID
	 * @param session - AT Protocol session for PDS operations
	 * @param deletePDSData - Whether to delete data from user's PDS
	 */
	async deleteUser(
		did: string,
		session: ATSession,
		deletePDSData: boolean,
	): Promise<void> {
		await this.userDeletionService.deleteUser(did, session, deletePDSData);
	}
}
