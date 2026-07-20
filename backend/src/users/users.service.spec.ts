import type { Mock, MockedFunction } from "vitest";
import {
	BadGatewayException,
	BadRequestException,
	NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
	FetchTraktPublicHistoryResponseDto,
	ImportHistoryResponseDto,
	NormalizedImportItemDto,
	StartTraktImportResponseDto,
	TraktImportJobDto,
} from "./dto/import-history.dto";
import type { ListsService } from "../lists/lists.service";
import type { MoviesService } from "../movies/movies.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { ShelfService } from "../shelf/shelf.service";
import type { ShowsService } from "../shows/shows.service";

vi.mock("./profile.service", () => ({
	ProfileService: class MockProfileService {},
}));

import type { ReviewsService } from "../reviews/reviews.service";
import type { ImportHistoryService } from "./import-history.service";
import type { ProfileService } from "./profile.service";
import type { UserDeletionService } from "./user-deletion.service";
import { UsersService } from "./users.service";

type MockImportHistoryService = {
	fetchTraktPublicHistory: MockedFunction<
		(
			username: string,
			maxItems?: number,
		) => Promise<FetchTraktPublicHistoryResponseDto>
	>;
	startTraktImport: MockedFunction<
		(userDid: string, username: string) => Promise<StartTraktImportResponseDto>
	>;
	getCurrentTraktImport: MockedFunction<
		(userDid: string) => Promise<TraktImportJobDto | null>
	>;
	importNormalizedItems: MockedFunction<
		(
			userDid: string,
			session: { did: string },
			items: NormalizedImportItemDto[],
		) => Promise<ImportHistoryResponseDto>
	>;
};

describe("UsersService", () => {
	let service: UsersService;
	let importHistoryService: MockImportHistoryService;
	let reviewsService: ReviewsService;

	const prisma = {
		user: {
			findUnique: vi.fn(),
			findMany: vi.fn(),
			update: vi.fn(),
		},
		follow: {
			findMany: vi.fn(),
			createMany: vi.fn(),
		},
		trackedMovie: {
			findFirst: vi.fn(),
			count: vi.fn().mockResolvedValue(0),
			findMany: vi.fn().mockResolvedValue([]),
		},
		trackedEpisode: {
			findFirst: vi.fn(),
			count: vi.fn().mockResolvedValue(0),
			findMany: vi.fn().mockResolvedValue([]),
			groupBy: vi.fn().mockResolvedValue([]),
		},
		show: {
			findUnique: vi.fn().mockResolvedValue(null),
		},
		$queryRaw: vi.fn().mockResolvedValue([{ count: 0 }]),
	} as unknown as PrismaService;

	const shelfService = {
		getUserActivitySummary: vi.fn().mockResolvedValue({
			watchedLast7Days: 0,
			watchedLast30Days: 0,
			dailyActivity: Array.from({ length: 30 }, (_, i) => ({
				date: `2024-03-${String(i + 1).padStart(2, "0")}`,
				count: 0,
			})),
		}),
	} as unknown as ShelfService;

	const moviesService = {
		markWatched: vi.fn(),
		indexTrackedMovie: vi.fn(),
	} as unknown as MoviesService;

	const showsService = {
		markEpisodeWatched: vi.fn(),
		indexTrackedEpisode: vi.fn(),
	} as unknown as ShowsService;

	const configService = {
		get: vi.fn((key: string) => {
			if (key === "TRAKT_API_KEY") return "trakt-key";
			return undefined;
		}),
	} as unknown as ConfigService;

	const userDeletionService = {
		deleteUserSync: vi.fn(),
		createDeletionJob: vi.fn(),
		getCurrentDeletionJob: vi.fn(),
	} as unknown as UserDeletionService;

	const profileService = {
		updateProfile: vi.fn(),
		seedProfileForNewUser: vi.fn(),
		deleteAvatar: vi.fn(),
		deleteProfileRecordIndex: vi.fn(),
		streamAvatar: vi.fn(),
		discoverSocialProfiles: vi.fn(),
	} as unknown as ProfileService;

	const listsService = {
		hasAllDefaultLists: vi.fn(),
		provisionDefaultLists: vi.fn(),
	} as unknown as ListsService;

	beforeEach(() => {
		vi.clearAllMocks();
		importHistoryService = {
			fetchTraktPublicHistory: vi.fn(),
			startTraktImport: vi.fn(),
			getCurrentTraktImport: vi.fn(),
			importNormalizedItems: vi.fn(),
		};
		(listsService.hasAllDefaultLists as Mock).mockResolvedValue(true);
		reviewsService = {
			listMyPublications: vi.fn(),
		} as unknown as ReviewsService;
		service = new UsersService(
			prisma,
			importHistoryService as unknown as ImportHistoryService,
			userDeletionService,
			profileService,
			listsService,
			reviewsService,
			shelfService,
		);
	});

	// No afterEach restoreAllMocks: the Logger spies live on the per-test
	// `service` instance (recreated each beforeEach), so they never leak.
	// Vitest's restoreAllMocks would also wipe the describe-scope vi.fn()
	// defaults (which Jest's left intact).

	describe("updateUserSettings reviews publication", () => {
		it("stores uri + cached name when the target is one of the user's own publications", async () => {
			(prisma.user.findUnique as Mock).mockResolvedValue({
				did: "did:plc:123",
			});
			(reviewsService.listMyPublications as Mock).mockResolvedValue([
				{
					uri: "at://did:plc:123/site.standard.publication/leaflet",
					name: "My Blog",
					url: "https://leaflet.pub/me",
					isOpnshelfDefault: false,
				},
			]);
			(prisma.user.update as Mock).mockResolvedValue({
				timezone: "UTC",
				timeFormat: "24h",
				watchCountry: "US",
				reviewsPublicationUri:
					"at://did:plc:123/site.standard.publication/leaflet",
				reviewsPublicationName: "My Blog",
				reviewsMirrorFormat: "markdown",
			});

			const result = await service.updateUserSettings(
				"did:plc:123",
				{
					reviewsPublicationUri:
						"at://did:plc:123/site.standard.publication/leaflet",
				},
				{ did: "did:plc:123" },
			);

			expect(prisma.user.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						reviewsPublicationUri:
							"at://did:plc:123/site.standard.publication/leaflet",
						reviewsPublicationName: "My Blog",
					}),
				}),
			);
			expect(result.reviewsPublicationName).toBe("My Blog");
		});

		it("rejects a target that is not among the user's own publications", async () => {
			(prisma.user.findUnique as Mock).mockResolvedValue({
				did: "did:plc:123",
			});
			(reviewsService.listMyPublications as Mock).mockResolvedValue([]);

			await expect(
				service.updateUserSettings(
					"did:plc:123",
					{ reviewsPublicationUri: "at://did:plc:999/x/y" },
					{ did: "did:plc:123" },
				),
			).rejects.toThrow(BadRequestException);
		});

		it("clears the override to the opnshelf default when set to null", async () => {
			(prisma.user.findUnique as Mock).mockResolvedValue({
				did: "did:plc:123",
			});
			(prisma.user.update as Mock).mockResolvedValue({
				timezone: "UTC",
				timeFormat: "24h",
				watchCountry: "US",
				reviewsPublicationUri: null,
				reviewsPublicationName: null,
				reviewsMirrorFormat: "markdown",
			});

			const result = await service.updateUserSettings(
				"did:plc:123",
				{ reviewsPublicationUri: null },
				{ did: "did:plc:123" },
			);

			expect(reviewsService.listMyPublications).not.toHaveBeenCalled();
			expect(prisma.user.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						reviewsPublicationUri: null,
						reviewsPublicationName: null,
					}),
				}),
			);
			expect(result.reviewsPublicationUri).toBeNull();
		});

		it("stores an explicitly selected reader format", async () => {
			(prisma.user.findUnique as Mock).mockResolvedValue({
				did: "did:plc:123",
			});
			(prisma.user.update as Mock).mockResolvedValue({
				timezone: "UTC",
				timeFormat: "24h",
				watchCountry: "US",
				reviewsPublicationUri:
					"at://did:plc:123/site.standard.publication/leaflet",
				reviewsPublicationName: "My Blog",
				reviewsMirrorFormat: "leaflet",
			});

			const result = await service.updateUserSettings("did:plc:123", {
				reviewsMirrorFormat: "leaflet",
			});

			expect(prisma.user.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ reviewsMirrorFormat: "leaflet" }),
				}),
			);
			expect(result.reviewsMirrorFormat).toBe("leaflet");
		});
	});

	it("completes onboarding for an existing user", async () => {
		prisma.user.findUnique = vi.fn().mockResolvedValue({ did: "did:plc:123" });
		prisma.user.update = vi.fn().mockResolvedValue({
			onboardingCompletedAt: new Date("2026-03-03T12:00:00.000Z"),
		});

		await expect(service.completeOnboarding("did:plc:123")).resolves.toEqual({
			onboardingCompletedAt: "2026-03-03T12:00:00.000Z",
			needsOnboarding: false,
		});
	});

	it("throws when completing onboarding for missing user", async () => {
		prisma.user.findUnique = vi.fn().mockResolvedValue(null);

		await expect(service.completeOnboarding("did:plc:missing")).rejects.toThrow(
			NotFoundException,
		);
	});

	it("updates user settings without logging routine success", async () => {
		prisma.user.findUnique = vi.fn().mockResolvedValue({ did: "did:plc:123" });
		prisma.user.update = vi.fn().mockResolvedValue({
			timezone: "Europe/Amsterdam",
			timeFormat: "24h",
		});
		const logSpy = vi.spyOn(
			(service as unknown as { logger: { log: (...args: unknown[]) => void } })
				.logger,
			"log",
		);

		await expect(
			service.updateUserSettings("did:plc:123", {
				timezone: "Europe/Amsterdam",
				timeFormat: "24h",
			}),
		).resolves.toEqual({
			timezone: "Europe/Amsterdam",
			timeFormat: "24h",
		});

		expect(logSpy).not.toHaveBeenCalled();
	});

	it("throws when updating profile for missing user", async () => {
		prisma.user.findUnique = vi.fn().mockResolvedValue(null);

		await expect(
			service.updateUserProfile(
				"did:plc:missing",
				{ did: "did:plc:missing" },
				{ displayName: "Nope" },
			),
		).rejects.toThrow(NotFoundException);
	});

	it("provisions default lists after the first profile save", async () => {
		prisma.user.findUnique = vi
			.fn()
			.mockResolvedValueOnce({ did: "did:plc:first" })
			.mockResolvedValueOnce({ profileRkey: null });
		(listsService.hasAllDefaultLists as Mock).mockResolvedValue(false);
		(profileService.updateProfile as Mock).mockResolvedValue({
			displayName: "First User",
			avatar: null,
		});
		(listsService.provisionDefaultLists as Mock).mockResolvedValue([]);

		await expect(
			service.updateUserProfile("did:plc:first", { did: "did:plc:first" }, {}),
		).resolves.toEqual({
			displayName: "First User",
			avatar: null,
		});

		expect(listsService.provisionDefaultLists).toHaveBeenCalledWith(
			"did:plc:first",
			{ did: "did:plc:first" },
		);
		expect(profileService.deleteProfileRecordIndex).not.toHaveBeenCalled();
	});

	it("rolls back the local profile index if default list provisioning fails on first save", async () => {
		prisma.user.findUnique = vi
			.fn()
			.mockResolvedValueOnce({ did: "did:plc:first" })
			.mockResolvedValueOnce({ profileRkey: null });
		(listsService.hasAllDefaultLists as Mock).mockResolvedValue(false);
		(profileService.updateProfile as Mock).mockResolvedValue({
			displayName: "First User",
			avatar: null,
		});
		(listsService.provisionDefaultLists as Mock).mockRejectedValue(
			new Error("pds list failure"),
		);

		await expect(
			service.updateUserProfile("did:plc:first", { did: "did:plc:first" }, {}),
		).rejects.toThrow("pds list failure");

		expect(profileService.deleteProfileRecordIndex).toHaveBeenCalledWith(
			"did:plc:first",
		);
	});

	it("initializes the seeded profile and default lists for a new user", async () => {
		prisma.user.findUnique = vi.fn().mockResolvedValue({ profileRkey: null });
		(listsService.hasAllDefaultLists as Mock).mockResolvedValue(false);
		(profileService.seedProfileForNewUser as Mock).mockResolvedValue(undefined);
		(listsService.provisionDefaultLists as Mock).mockResolvedValue([]);
		(profileService.discoverSocialProfiles as Mock).mockResolvedValue(
			undefined,
		);

		await expect(
			service.initializeProfileForNewUser(
				"did:plc:new123",
				{ did: "did:plc:new123" },
				{
					handle: "new-user.bsky.social",
					displayName: "New User",
					avatarUrl: "https://example.com/avatar.jpg",
				},
			),
		).resolves.toBeUndefined();

		expect(profileService.seedProfileForNewUser).toHaveBeenCalledWith(
			"did:plc:new123",
			{ did: "did:plc:new123" },
			{
				handle: "new-user.bsky.social",
				displayName: "New User",
				avatarUrl: "https://example.com/avatar.jpg",
			},
		);
		expect(listsService.provisionDefaultLists).toHaveBeenCalledWith(
			"did:plc:new123",
			{ did: "did:plc:new123" },
		);
	});

	it("returns a public profile by normalized handle", async () => {
		prisma.user.findUnique = vi.fn().mockResolvedValue({
			did: "did:plc:123",
			handle: "alice.bsky.social",
			displayName: "Alice",
			avatar: "https://example.com/alice.jpg",
			timezone: "Europe/Amsterdam",
			blueskyProfileUrl: null,
			tangledProfileUrl: null,
			showBlueskyOnProfile: true,
			showTangledOnProfile: true,
			_count: {
				followers: 4,
				following: 7,
				reviews: 2,
			},
		});

		const profile = await service.getPublicProfileByHandle(
			" @Alice.Bsky.Social ",
		);

		expect(profile).toMatchObject({
			did: "did:plc:123",
			handle: "alice.bsky.social",
			displayName: "Alice",
			avatar: "https://example.com/alice.jpg",
			blueskyProfileUrl: null,
			tangledProfileUrl: null,
			showBlueskyOnProfile: true,
			showTangledOnProfile: true,
			followersCount: 4,
			followingCount: 7,
			reviewsCount: 2,
			watchedThisYear: 0,
			mostWatchedShow: null,
		});
		// 30-day activity graph always has one bucket per day.
		expect(profile.activityLast30Days).toHaveLength(30);
		expect(prisma.user.findUnique).toHaveBeenCalledWith({
			where: { handle: "alice.bsky.social" },
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

		const yearSql = (prisma.$queryRaw as Mock).mock.calls.at(-1)?.[0];
		const yearQueryText = Array.isArray(yearSql?.strings)
			? yearSql.strings.join(" ")
			: String(yearSql);
		expect(yearQueryText).toContain(
			"(tm.\"watchedDate\" AT TIME ZONE 'UTC' AT TIME ZONE",
		);
		expect(yearQueryText).toContain(
			"(te.\"watchedDate\" AT TIME ZONE 'UTC' AT TIME ZONE",
		);
	});

	it("returns public profile counts from follow aggregates", async () => {
		prisma.user.findUnique = vi.fn().mockResolvedValue({
			did: "did:plc:123",
			handle: "alice.bsky.social",
			displayName: "Alice",
			avatar: "https://example.com/alice.jpg",
			_count: {
				followers: 11,
				following: 3,
			},
		});

		await expect(
			service.getPublicProfileByHandle("alice.bsky.social"),
		).resolves.toMatchObject({
			followersCount: 11,
			followingCount: 3,
		});
	});

	it("imports Bluesky follows with pagination and creates only missing local follows", async () => {
		prisma.user.findUnique = vi
			.fn()
			.mockResolvedValueOnce({ did: "did:plc:self" });
		prisma.user.findMany = vi
			.fn()
			.mockResolvedValue([
				{ did: "did:plc:friend-1" },
				{ did: "did:plc:friend-2" },
			]);
		prisma.follow.findMany = vi
			.fn()
			.mockResolvedValue([{ followingDid: "did:plc:friend-2" }]);
		prisma.follow.createMany = vi.fn().mockResolvedValue({ count: 1 });

		global.fetch = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				statusText: "OK",
				json: async () => ({
					cursor: "cursor-2",
					follows: [{ did: "did:plc:friend-1" }, { did: "did:plc:friend-2" }],
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				statusText: "OK",
				json: async () => ({
					follows: [{ did: "did:plc:self" }, { did: "did:plc:off-app" }],
				}),
			}) as unknown as typeof fetch;

		await expect(service.importBlueskyFollows("did:plc:self")).resolves.toEqual(
			{
				scannedCount: 4,
				matchedCount: 2,
				createdCount: 1,
				alreadyFollowingCount: 1,
			},
		);

		expect(prisma.user.findMany).toHaveBeenCalledWith({
			where: {
				did: {
					in: ["did:plc:friend-1", "did:plc:friend-2", "did:plc:off-app"],
				},
			},
			select: { did: true },
		});
		expect(prisma.follow.createMany).toHaveBeenCalledWith({
			data: [
				{
					followerDid: "did:plc:self",
					followingDid: "did:plc:friend-1",
				},
			],
			skipDuplicates: true,
		});
	});

	it("returns zero counts when no Bluesky follows match Opnshelf users", async () => {
		prisma.user.findUnique = vi
			.fn()
			.mockResolvedValueOnce({ did: "did:plc:self" });
		prisma.user.findMany = vi.fn().mockResolvedValue([]);
		prisma.follow.findMany = vi.fn().mockResolvedValue([]);
		prisma.follow.createMany = vi.fn();

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			statusText: "OK",
			json: async () => ({
				follows: [{ did: "did:plc:off-app" }],
			}),
		}) as unknown as typeof fetch;

		await expect(service.importBlueskyFollows("did:plc:self")).resolves.toEqual(
			{
				scannedCount: 1,
				matchedCount: 0,
				createdCount: 0,
				alreadyFollowingCount: 0,
			},
		);
		expect(prisma.follow.createMany).not.toHaveBeenCalled();
	});

	it("maps Bluesky fetch failures to a gateway error", async () => {
		prisma.user.findUnique = vi
			.fn()
			.mockResolvedValueOnce({ did: "did:plc:self" });
		const warnSpy = vi.spyOn(
			(service as unknown as { logger: { warn: (...args: unknown[]) => void } })
				.logger,
			"warn",
		);

		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 503,
			statusText: "Service Unavailable",
		}) as unknown as typeof fetch;

		await expect(service.importBlueskyFollows("did:plc:self")).rejects.toThrow(
			BadGatewayException,
		);
		expect(warnSpy).not.toHaveBeenCalled();
	});

	it("maps Bluesky network failures to a gateway error without warning noise", async () => {
		prisma.user.findUnique = vi
			.fn()
			.mockResolvedValueOnce({ did: "did:plc:self" });
		const warnSpy = vi.spyOn(
			(service as unknown as { logger: { warn: (...args: unknown[]) => void } })
				.logger,
			"warn",
		);

		global.fetch = vi
			.fn()
			.mockRejectedValue(
				new Error("socket timeout"),
			) as unknown as typeof fetch;

		await expect(service.importBlueskyFollows("did:plc:self")).rejects.toThrow(
			BadGatewayException,
		);
		expect(warnSpy).not.toHaveBeenCalled();
	});

	it("throws when public profile handle is missing", async () => {
		prisma.user.findUnique = vi.fn().mockResolvedValue(null);

		await expect(
			service.getPublicProfileByHandle("nobody.bsky.social"),
		).rejects.toThrow(NotFoundException);
	});

	it("starts a background Trakt import for an existing user", async () => {
		prisma.user.findUnique = vi.fn().mockResolvedValue({ did: "did:plc:abc" });
		importHistoryService.startTraktImport.mockResolvedValue({
			profile: {
				username: "alice",
				slug: "alice",
				name: "Alice Example",
				isPrivate: false,
				isVip: false,
				avatarUrl: "https://example.com/avatar.jpg",
			},
			previewItems: [],
			sourcePreviewCount: 25,
			job: {
				id: "job-1",
				traktUsername: "alice",
				status: "queued",
				currentPage: 1,
				sourceCount: 0,
				normalizedCount: 0,
				importedCount: 0,
				skippedCount: 0,
				failedCount: 0,
				nextRunAt: "2026-03-23T18:00:00.000Z",
				createdAt: "2026-03-23T18:00:00.000Z",
				updatedAt: "2026-03-23T18:00:00.000Z",
			},
		});

		await expect(
			service.startTraktImport("did:plc:abc", "alice"),
		).resolves.toMatchObject({
			job: {
				id: "job-1",
				status: "queued",
			},
		});
		expect(importHistoryService.startTraktImport).toHaveBeenCalledWith(
			"did:plc:abc",
			"alice",
		);
	});

	it("propagates normalized history import failures", async () => {
		const error = new BadRequestException("Too many items");
		importHistoryService.importNormalizedItems.mockRejectedValue(error);

		await expect(
			service.importNormalizedItems("did:plc:abc", { did: "did:plc:abc" }, []),
		).rejects.toThrow(error);
	});
});
