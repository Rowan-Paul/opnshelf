import { rebaseAvatarUrl } from "./avatar-url";
import {
	BadGatewayException,
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { Prisma, type BlogMirrorFormat } from "../generated/client";
import { ListsService } from "../lists/lists.service";
import { ReviewsService } from "../reviews/reviews.service";
import { PrismaService } from "../prisma/prisma.service";
import { ShelfService } from "../shelf/shelf.service";
import type {
	CompleteOnboardingResponseDto,
	FetchTraktPublicHistoryResponseDto,
	ImportBlueskyFollowsResponseDto,
	ImportHistoryResponseDto,
	NormalizedImportItemDto,
	StartTraktImportResponseDto,
	TraktImportJobDto,
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
		private readonly listsService: ListsService,
		private readonly reviewsService: ReviewsService,
		private readonly shelfService: ShelfService,
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
				watchCountry: true,
				alwaysShowSpoilers: true,
				reviewsPublicationUri: true,
				reviewsPublicationName: true,
				reviewsMirrorFormat: true,
				blogIntegrationEnabled: true,
				blueskyCrossPostEnabled: true,
				welcomeTourWebVersion: true,
				welcomeTourMobileVersion: true,
			},
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		return {
			timezone: user.timezone,
			timeFormat: user.timeFormat,
			watchCountry: user.watchCountry,
			alwaysShowSpoilers: user.alwaysShowSpoilers,
			reviewsPublicationUri: user.reviewsPublicationUri,
			reviewsPublicationName: user.reviewsPublicationName,
			reviewsMirrorFormat: user.reviewsMirrorFormat,
			blogIntegrationEnabled: user.blogIntegrationEnabled,
			blueskyCrossPostEnabled: user.blueskyCrossPostEnabled,
			welcomeTourWebVersion: user.welcomeTourWebVersion,
			welcomeTourMobileVersion: user.welcomeTourMobileVersion,
		};
	}

	/**
	 * Update user settings
	 */
	async updateUserSettings(
		did: string,
		dto: UpdateUserSettingsDto,
		session?: ATSession,
	): Promise<UserSettingsDto> {
		const user = await this.prisma.user.findUnique({
			where: { did },
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		// Reviews-publication override (#118 / ADR-0003). Setting a URI stores both
		// the URI and a cached display name; null reverts to the opnshelf default.
		// When setting, enforce D1 ownership: the URI MUST be among the user's own
		// publications listed live from their PDS.
		const reviewsPublicationPatch: {
			reviewsPublicationUri?: string | null;
			reviewsPublicationName?: string | null;
		} = {};
		if (dto.reviewsPublicationUri !== undefined) {
			if (dto.reviewsPublicationUri === null) {
				reviewsPublicationPatch.reviewsPublicationUri = null;
				reviewsPublicationPatch.reviewsPublicationName = null;
			} else {
				if (!session) {
					throw new BadRequestException(
						"Session is required to set a reviews publication",
					);
				}
				const myPublications = await this.reviewsService.listMyPublications(
					did,
					session,
				);
				const target = myPublications.find(
					(pub) => pub.uri === dto.reviewsPublicationUri,
				);
				if (!target) {
					throw new BadRequestException(
						"Publication is not one of your own publications",
					);
				}
				reviewsPublicationPatch.reviewsPublicationUri = target.uri;
				reviewsPublicationPatch.reviewsPublicationName = target.name;
			}
		}

		const updatedUser = await this.prisma.user.update({
			where: { did },
			data: {
				...(dto.timezone !== undefined && { timezone: dto.timezone }),
				...(dto.timeFormat !== undefined && { timeFormat: dto.timeFormat }),
				...(dto.watchCountry !== undefined && {
					watchCountry: dto.watchCountry,
				}),
				...(dto.alwaysShowSpoilers !== undefined && {
					alwaysShowSpoilers: dto.alwaysShowSpoilers,
				}),
				...(dto.reviewsMirrorFormat !== undefined && {
					reviewsMirrorFormat: dto.reviewsMirrorFormat as BlogMirrorFormat,
				}),
				...(dto.welcomeTourWebVersion !== undefined && {
					welcomeTourWebVersion: dto.welcomeTourWebVersion,
				}),
				...(dto.welcomeTourMobileVersion !== undefined && {
					welcomeTourMobileVersion: dto.welcomeTourMobileVersion,
				}),
				...reviewsPublicationPatch,
			},
			select: {
				timezone: true,
				timeFormat: true,
				watchCountry: true,
				alwaysShowSpoilers: true,
				reviewsPublicationUri: true,
				reviewsPublicationName: true,
				reviewsMirrorFormat: true,
				blogIntegrationEnabled: true,
				blueskyCrossPostEnabled: true,
				welcomeTourWebVersion: true,
				welcomeTourMobileVersion: true,
			},
		});

		// Selecting a blog or changing its reader format backfills existing mirrors
		// so they converge on the saved explicit choice (ADR-0013/0014).
		// Best-effort — a mirror hiccup must not fail the settings save.
		if (
			updatedUser.reviewsPublicationUri &&
			(reviewsPublicationPatch.reviewsPublicationUri ||
				dto.reviewsMirrorFormat !== undefined) &&
			session
		) {
			try {
				await this.reviewsService.backfillBlogMirror(did, session);
			} catch (error) {
				this.logger.warn(
					`Blog-mirror backfill failed for ${did}`,
					error instanceof Error ? error.stack : undefined,
				);
			}
		}

		return {
			timezone: updatedUser.timezone,
			timeFormat: updatedUser.timeFormat,
			alwaysShowSpoilers: updatedUser.alwaysShowSpoilers,
			watchCountry: updatedUser.watchCountry,
			reviewsPublicationUri: updatedUser.reviewsPublicationUri,
			reviewsPublicationName: updatedUser.reviewsPublicationName,
			reviewsMirrorFormat: updatedUser.reviewsMirrorFormat,
			blogIntegrationEnabled: updatedUser.blogIntegrationEnabled,
			blueskyCrossPostEnabled: updatedUser.blueskyCrossPostEnabled,
			welcomeTourWebVersion: updatedUser.welcomeTourWebVersion,
			welcomeTourMobileVersion: updatedUser.welcomeTourMobileVersion,
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

		const updatedProfile = await this.runProfileWriteWithDefaultLists(
			did,
			session,
			() =>
				this.profileService.updateProfile(did, session, {
					displayName: dto.displayName,
				}),
		);

		const visibilityData: Record<string, boolean> = {};
		if (dto.showBlueskyOnProfile !== undefined) {
			visibilityData.showBlueskyOnProfile = dto.showBlueskyOnProfile;
		}
		if (dto.showTangledOnProfile !== undefined) {
			visibilityData.showTangledOnProfile = dto.showTangledOnProfile;
		}

		if (Object.keys(visibilityData).length > 0) {
			await this.prisma.user.update({
				where: { did },
				data: visibilityData,
			});
		}

		return {
			...updatedProfile,
			blueskyProfileUrl: user.blueskyProfileUrl,
			tangledProfileUrl: user.tangledProfileUrl,
			showBlueskyOnProfile:
				dto.showBlueskyOnProfile ?? user.showBlueskyOnProfile,
			showTangledOnProfile:
				dto.showTangledOnProfile ?? user.showTangledOnProfile,
		};
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

		const updatedProfile = await this.runProfileWriteWithDefaultLists(
			did,
			session,
			() =>
				this.profileService.updateProfile(did, session, {
					avatar: file,
				}),
		);
		return {
			...updatedProfile,
			blueskyProfileUrl: user.blueskyProfileUrl,
			tangledProfileUrl: user.tangledProfileUrl,
			showBlueskyOnProfile: user.showBlueskyOnProfile,
			showTangledOnProfile: user.showTangledOnProfile,
		};
	}

	async deleteUserAvatar(
		did: string,
		session: ATSession,
	): Promise<UserProfileDto> {
		const user = await this.prisma.user.findUnique({ where: { did } });

		if (!user) {
			throw new NotFoundException("User not found");
		}

		const updatedProfile = await this.runProfileWriteWithDefaultLists(
			did,
			session,
			() => this.profileService.deleteAvatar(did, session),
		);
		return {
			...updatedProfile,
			blueskyProfileUrl: user.blueskyProfileUrl,
			tangledProfileUrl: user.tangledProfileUrl,
			showBlueskyOnProfile: user.showBlueskyOnProfile,
			showTangledOnProfile: user.showTangledOnProfile,
		};
	}

	async initializeProfileForNewUser(
		did: string,
		session: ATSession,
		seed: {
			handle: string;
			displayName: string | null;
			avatarUrl: string | null;
		},
	): Promise<void> {
		await this.runProfileWriteWithDefaultLists(did, session, () =>
			this.profileService.seedProfileForNewUser(did, session, seed),
		);
		// Discover social profiles asynchronously — don't block onboarding
		void this.profileService.discoverSocialProfiles(did, seed.handle);
	}

	async streamUserAvatar(
		did: string,
		cid: string,
		response: import("express").Response,
	) {
		return this.profileService.streamAvatar(did, cid, response);
	}

	async getUserHandle(did: string): Promise<string> {
		const user = await this.prisma.user.findUnique({
			where: { did },
			select: { handle: true },
		});
		if (!user) {
			throw new NotFoundException("User not found");
		}
		return user.handle;
	}

	async refreshSocialProfiles(
		did: string,
		handle: string,
	): Promise<UserProfileDto> {
		const user = await this.prisma.user.findUnique({
			where: { did },
			select: {
				displayName: true,
				avatar: true,
				blueskyProfileUrl: true,
				tangledProfileUrl: true,
				showBlueskyOnProfile: true,
				showTangledOnProfile: true,
			},
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		await this.profileService.discoverSocialProfiles(did, handle);

		// Re-fetch to get updated URLs
		const updated = await this.prisma.user.findUnique({
			where: { did },
			select: {
				displayName: true,
				avatar: true,
				blueskyProfileUrl: true,
				tangledProfileUrl: true,
				showBlueskyOnProfile: true,
				showTangledOnProfile: true,
			},
		});

		return {
			displayName: updated?.displayName ?? user.displayName,
			avatar: rebaseAvatarUrl(updated?.avatar ?? user.avatar),
			blueskyProfileUrl: updated?.blueskyProfileUrl ?? null,
			tangledProfileUrl: updated?.tangledProfileUrl ?? null,
			showBlueskyOnProfile: updated?.showBlueskyOnProfile ?? true,
			showTangledOnProfile: updated?.showTangledOnProfile ?? true,
		};
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
				timezone: true,
				blueskyProfileUrl: true,
				tangledProfileUrl: true,
				showBlueskyOnProfile: true,
				showTangledOnProfile: true,
				_count: {
					select: {
						followers: true,
						following: true,
						reviews: true,
					},
				},
			},
		});

		if (!user) {
			throw new NotFoundException("User not found");
		}

		const stats = await this.getProfileStats(user.did, user.timezone);

		return {
			did: user.did,
			handle: user.handle,
			displayName: user.displayName,
			avatar: rebaseAvatarUrl(user.avatar),
			blueskyProfileUrl: user.blueskyProfileUrl,
			tangledProfileUrl: user.tangledProfileUrl,
			showBlueskyOnProfile: user.showBlueskyOnProfile,
			showTangledOnProfile: user.showTangledOnProfile,
			followersCount: user._count.followers,
			followingCount: user._count.following,
			reviewsCount: user._count.reviews,
			...stats,
		};
	}

	/**
	 * Compute the derived stats shown in the profile header: a 30-day watch
	 * activity graph, the most-watched show over the trailing 30 days, and the
	 * current year's watch count. A "watch" is one tracked row with status
	 * `watched` and a `watchedDate` — rewatches are counted, watchlist adds are
	 * not (see the Watch term in CONTEXT.md). Day/year windows are bucketed in
	 * the profile owner's own timezone, reusing the same activity logic the
	 * dashboard renders so both surfaces agree; the most-watched show uses a
	 * rolling 30-day cutoff from now, so it doesn't need timezone bucketing.
	 */
	private async getProfileStats(
		did: string,
		timezone: string,
	): Promise<{
		activityLast30Days: { date: string; count: number }[];
		mostWatchedShow: {
			showId: string;
			title: string;
			posterPath: string | null;
			episodeWatchCount: number;
		} | null;
		watchedThisYear: number;
	}> {
		const [activitySummary, yearRows, topShow] = await Promise.all([
			this.shelfService.getUserActivitySummary(did),
			this.prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
				SELECT (
					(SELECT COUNT(*) FROM "TrackedMovie" tm
						WHERE tm."userDid" = ${did}
							AND tm."status" = 'watched'
							AND tm."watchedDate" IS NOT NULL
							AND (tm."watchedDate" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date
								>= date_trunc('year', (now() AT TIME ZONE ${timezone}))::date)
					+
					(SELECT COUNT(*) FROM "TrackedEpisode" te
						WHERE te."userDid" = ${did}
							AND te."status" = 'watched'
							AND te."watchedDate" IS NOT NULL
							AND (te."watchedDate" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone})::date
								>= date_trunc('year', (now() AT TIME ZONE ${timezone}))::date)
				)::integer AS "count"
			`),
			this.prisma.trackedEpisode.groupBy({
				by: ["showId"],
				where: {
					userDid: did,
					status: "watched",
					watchedDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
				},
				_count: { showId: true },
				_max: { watchedDate: true },
				orderBy: [
					{ _count: { showId: "desc" } },
					{ _max: { watchedDate: "desc" } },
				],
				take: 1,
			}),
		]);

		const activityLast30Days = activitySummary.dailyActivity;
		const watchedThisYear = Number(yearRows[0]?.count ?? 0);

		let mostWatchedShow: {
			showId: string;
			title: string;
			posterPath: string | null;
			episodeWatchCount: number;
		} | null = null;
		const top = topShow[0];
		if (top && top._count.showId > 0) {
			const show = await this.prisma.show.findUnique({
				where: { showId: top.showId },
				select: { showId: true, title: true, posterPath: true },
			});
			if (show) {
				mostWatchedShow = {
					showId: show.showId,
					title: show.title,
					posterPath: show.posterPath,
					episodeWatchCount: top._count.showId,
				};
			}
		}

		return {
			activityLast30Days,
			mostWatchedShow,
			watchedThisYear,
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
	): Promise<FetchTraktPublicHistoryResponseDto> {
		return this.importHistoryService.fetchTraktPublicHistory(username);
	}

	async startTraktImport(
		userDid: string,
		username: string,
	): Promise<StartTraktImportResponseDto> {
		const user = await this.prisma.user.findUnique({
			where: { did: userDid },
			select: { did: true },
		});
		if (!user) {
			throw new NotFoundException("User not found");
		}

		return this.importHistoryService.startTraktImport(userDid, username);
	}

	async getCurrentTraktImport(
		userDid: string,
	): Promise<TraktImportJobDto | null> {
		const user = await this.prisma.user.findUnique({
			where: { did: userDid },
			select: { did: true },
		});
		if (!user) {
			throw new NotFoundException("User not found");
		}

		return this.importHistoryService.getCurrentTraktImport(userDid);
	}

	async pauseTraktImport(userDid: string) {
		return this.importHistoryService.pauseTraktImport(userDid);
	}

	async resumeTraktImport(userDid: string) {
		return this.importHistoryService.resumeTraktImport(userDid);
	}

	async acknowledgeTraktImport(userDid: string) {
		return this.importHistoryService.acknowledgeTraktImport(userDid);
	}

	async snoozeTraktReminder(userDid: string) {
		return this.importHistoryService.snoozeTraktReminder(userDid);
	}

	async getTraktImportIssues(
		userDid: string,
		page: number,
		pageSize: number,
		outcome?: "unmatched" | "couldnt_import",
	) {
		return this.importHistoryService.getTraktImportIssues(
			userDid,
			page,
			pageSize,
			outcome,
		);
	}

	async getTraktMatchCandidates(
		userDid: string,
		matchKey: string,
		query?: string,
	) {
		return this.importHistoryService.getTraktMatchCandidates(
			userDid,
			matchKey,
			query,
		);
	}

	async confirmTraktMatch(userDid: string, matchKey: string, tmdbId: string) {
		return this.importHistoryService.confirmTraktMatch(
			userDid,
			matchKey,
			tmdbId,
		);
	}

	async rejectTraktMatch(userDid: string, matchKey: string) {
		return this.importHistoryService.rejectTraktMatch(userDid, matchKey);
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

	async deleteUserSync(did: string): Promise<void> {
		await this.userDeletionService.deleteUserSync(did);
	}

	async createDeletionJob(did: string, deletePDSData: boolean) {
		return this.userDeletionService.createDeletionJob(did, deletePDSData);
	}

	async getCurrentDeletionJob(userDid: string) {
		return this.userDeletionService.getCurrentDeletionJob(userDid);
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
			throw new BadGatewayException(
				"Could not import Bluesky follows right now",
			);
		}

		return [...followedDids];
	}

	private async runProfileWriteWithDefaultLists<T>(
		did: string,
		session: ATSession,
		writeProfile: () => Promise<T>,
	): Promise<T> {
		const user = await this.prisma.user.findUnique({
			where: { did },
			select: { profileRkey: true },
		});
		const hadProfileRecord = Boolean(user?.profileRkey);
		const needsDefaultLists =
			!(await this.listsService.hasAllDefaultLists(did));
		const result = await writeProfile();

		if (!needsDefaultLists) {
			return result;
		}

		try {
			await this.listsService.provisionDefaultLists(did, session);
		} catch (error) {
			if (!hadProfileRecord) {
				try {
					await this.profileService.deleteProfileRecordIndex(did);
				} catch (rollbackError) {
					this.logger.warn(
						`Failed to roll back profile index after default list provisioning failed for ${did}`,
						rollbackError instanceof Error ? rollbackError.stack : undefined,
					);
				}
			}
			throw error;
		}

		return result;
	}
}
