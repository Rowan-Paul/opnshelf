import {
	BadGatewayException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type {
	CompleteOnboardingResponseDto,
	FetchTraktPublicHistoryResponseDto,
	ImportBlueskyFollowsResponseDto,
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
import { ProfileService } from "./profile.service";
import { UserDeletionService } from "./user-deletion.service";

interface ATSession {
	did: string;
}

const BLUESKY_PUBLIC_API = "https://public.api.bsky.app/xrpc";
const BLUESKY_FOLLOWS_PAGE_SIZE = 100;

@Injectable()
export class UsersService {
	private readonly logger = new Logger(UsersService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly importHistoryService: ImportHistoryService,
		private readonly userDeletionService: UserDeletionService,
		private readonly profileService: ProfileService,
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
		session: ATSession,
		dto: UpdateUserProfileDto,
	): Promise<UserProfileDto> {
		const user = await this.prisma.user.findUnique({ where: { did } });

		if (!user) {
			throw new NotFoundException("User not found");
		}

		const updatedProfile = await this.profileService.updateProfile(
			did,
			session,
			{
				displayName: dto.displayName,
			},
		);

		this.logger.log(`Updated OpnShelf profile for user ${did}`);

		return updatedProfile;
	}

	async uploadUserAvatar(
		did: string,
		session: ATSession,
		file: {
			buffer: Buffer;
			mimetype: string;
			size: number;
		},
	): Promise<UserProfileDto> {
		const user = await this.prisma.user.findUnique({ where: { did } });

		if (!user) {
			throw new NotFoundException("User not found");
		}

		const updatedProfile = await this.profileService.updateProfile(
			did,
			session,
			{
				avatar: file,
			},
		);
		this.logger.log(`Uploaded avatar for user ${did}`);
		return updatedProfile;
	}

	async deleteUserAvatar(
		did: string,
		session: ATSession,
	): Promise<UserProfileDto> {
		const user = await this.prisma.user.findUnique({ where: { did } });

		if (!user) {
			throw new NotFoundException("User not found");
		}

		const updatedProfile = await this.profileService.deleteAvatar(did, session);
		this.logger.log(`Deleted avatar for user ${did}`);
		return updatedProfile;
	}

	async streamUserAvatar(
		did: string,
		cid: string,
		response: import("express").Response,
	) {
		return this.profileService.streamAvatar(did, cid, response);
	}

	async getPublicProfileByHandle(
		handle: string,
	): Promise<PublicUserProfileDto> {
		const normalizedHandle = handle.trim().replace(/^@/, "").toLowerCase();
		const user = await this.prisma.user.findUnique({
			where: { handle: normalizedHandle },
			select: {
				did: true,
				handle: true,
				displayName: true,
				avatar: true,
				_count: {
					select: {
						followers: true,
						following: true,
					},
				},
			},
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		return {
			did: user.did,
			handle: user.handle,
			displayName: user.displayName,
			avatar: user.avatar,
			followersCount: user._count.followers,
			followingCount: user._count.following,
		};
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

	async importBlueskyFollows(
		userDid: string,
	): Promise<ImportBlueskyFollowsResponseDto> {
		const user = await this.prisma.user.findUnique({
			where: { did: userDid },
			select: { did: true },
		});
		if (!user) {
			throw new NotFoundException("User not found");
		}

		const followedDids = await this.fetchBlueskyFollowDids(userDid);
		if (followedDids.length === 0) {
			return {
				scannedCount: 0,
				matchedCount: 0,
				createdCount: 0,
				alreadyFollowingCount: 0,
			};
		}

		const candidateDids = followedDids.filter((did) => did !== userDid);
		if (candidateDids.length === 0) {
			return {
				scannedCount: followedDids.length,
				matchedCount: 0,
				createdCount: 0,
				alreadyFollowingCount: 0,
			};
		}

		const matchedUsers = await this.prisma.user.findMany({
			where: { did: { in: candidateDids } },
			select: { did: true },
		});
		const matchedDids = matchedUsers.map((matchedUser) => matchedUser.did);

		if (matchedDids.length === 0) {
			return {
				scannedCount: followedDids.length,
				matchedCount: 0,
				createdCount: 0,
				alreadyFollowingCount: 0,
			};
		}

		const existingFollows = await this.prisma.follow.findMany({
			where: {
				followerDid: userDid,
				followingDid: { in: matchedDids },
			},
			select: {
				followingDid: true,
			},
		});
		const existingFollowDids = new Set(
			existingFollows.map((follow) => follow.followingDid),
		);
		const followsToCreate = matchedDids.filter(
			(followingDid) => !existingFollowDids.has(followingDid),
		);

		if (followsToCreate.length > 0) {
			await this.prisma.follow.createMany({
				data: followsToCreate.map((followingDid) => ({
					followerDid: userDid,
					followingDid,
				})),
				skipDuplicates: true,
			});
		}

		return {
			scannedCount: followedDids.length,
			matchedCount: matchedDids.length,
			createdCount: followsToCreate.length,
			alreadyFollowingCount: existingFollowDids.size,
		};
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

	private async fetchBlueskyFollowDids(actorDid: string): Promise<string[]> {
		const followedDids = new Set<string>();
		let cursor: string | undefined;

		try {
			do {
				const url = new URL(`${BLUESKY_PUBLIC_API}/app.bsky.graph.getFollows`);
				url.searchParams.set("actor", actorDid);
				url.searchParams.set("limit", String(BLUESKY_FOLLOWS_PAGE_SIZE));
				if (cursor) {
					url.searchParams.set("cursor", cursor);
				}

				const response = await fetch(url.toString(), {
					signal: AbortSignal.timeout(5000),
				});
				if (!response.ok) {
					this.logger.warn(
						`Bluesky follows import failed for ${actorDid}: ${response.status} ${response.statusText}`,
					);
					throw new BadGatewayException(
						"Could not import Bluesky follows right now",
					);
				}

				const data = (await response.json()) as {
					cursor?: string;
					follows?: Array<{ did?: string }>;
				};

				for (const follow of data.follows ?? []) {
					if (typeof follow.did === "string" && follow.did.length > 0) {
						followedDids.add(follow.did);
					}
				}

				cursor = data.cursor;
			} while (cursor);
		} catch (error) {
			if (error instanceof BadGatewayException) {
				throw error;
			}

			this.logger.warn(
				`Failed to import Bluesky follows for ${actorDid}`,
				error,
			);
			throw new BadGatewayException(
				"Could not import Bluesky follows right now",
			);
		}

		return [...followedDids];
	}
}
