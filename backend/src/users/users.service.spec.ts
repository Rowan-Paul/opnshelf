import {
	BadGatewayException,
	BadRequestException,
	NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { MoviesService } from "../movies/movies.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { ShowsService } from "../shows/shows.service";
import { ImportHistoryService } from "./import-history.service";
import type { UserDeletionService } from "./user-deletion.service";
import { UsersService } from "./users.service";

describe("UsersService", () => {
	let service: UsersService;

	const prisma = {
		user: {
			findUnique: jest.fn(),
			findMany: jest.fn(),
			update: jest.fn(),
		},
		follow: {
			findMany: jest.fn(),
			createMany: jest.fn(),
		},
		trackedMovie: {
			findFirst: jest.fn(),
		},
		trackedEpisode: {
			findFirst: jest.fn(),
		},
	} as unknown as PrismaService;

	const moviesService = {
		markWatched: jest.fn(),
		indexTrackedMovie: jest.fn(),
	} as unknown as MoviesService;

	const showsService = {
		markEpisodeWatched: jest.fn(),
		indexTrackedEpisode: jest.fn(),
	} as unknown as ShowsService;

	const configService = {
		get: jest.fn((key: string) => {
			if (key === "TRAKT_API_KEY") return "trakt-key";
			return undefined;
		}),
	} as unknown as ConfigService;

	const userDeletionService = {
		deleteUser: jest.fn(),
	} as unknown as UserDeletionService;

	beforeEach(() => {
		jest.clearAllMocks();
		const importHistoryService = new ImportHistoryService(
			prisma,
			moviesService,
			showsService,
			configService,
		);
		service = new UsersService(
			prisma,
			importHistoryService,
			userDeletionService,
		);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("completes onboarding for an existing user", async () => {
		prisma.user.findUnique = jest
			.fn()
			.mockResolvedValue({ did: "did:plc:123" });
		prisma.user.update = jest.fn().mockResolvedValue({
			onboardingCompletedAt: new Date("2026-03-03T12:00:00.000Z"),
		});

		await expect(service.completeOnboarding("did:plc:123")).resolves.toEqual({
			onboardingCompletedAt: "2026-03-03T12:00:00.000Z",
			needsOnboarding: false,
		});
	});

	it("throws when completing onboarding for missing user", async () => {
		prisma.user.findUnique = jest.fn().mockResolvedValue(null);

		await expect(service.completeOnboarding("did:plc:missing")).rejects.toThrow(
			NotFoundException,
		);
	});

	it("updates user profile display name", async () => {
		prisma.user.findUnique = jest
			.fn()
			.mockResolvedValue({ did: "did:plc:123" });
		prisma.user.update = jest.fn().mockResolvedValue({
			displayName: "Updated User",
			avatar: "https://example.com/avatar.jpg",
		});

		await expect(
			service.updateUserProfile("did:plc:123", { displayName: "Updated User" }),
		).resolves.toEqual({
			displayName: "Updated User",
			avatar: "https://example.com/avatar.jpg",
		});
	});

	it("throws when updating profile for missing user", async () => {
		prisma.user.findUnique = jest.fn().mockResolvedValue(null);

		await expect(
			service.updateUserProfile("did:plc:missing", { displayName: "Nope" }),
		).rejects.toThrow(NotFoundException);
	});

	it("returns a public profile by normalized handle", async () => {
		prisma.user.findUnique = jest.fn().mockResolvedValue({
			did: "did:plc:123",
			handle: "alice.bsky.social",
			displayName: "Alice",
			avatar: "https://example.com/alice.jpg",
			_count: {
				followers: 4,
				following: 7,
			},
		});

		await expect(
			service.getPublicProfileByHandle(" @Alice.Bsky.Social "),
		).resolves.toEqual({
			did: "did:plc:123",
			handle: "alice.bsky.social",
			displayName: "Alice",
			avatar: "https://example.com/alice.jpg",
			followersCount: 4,
			followingCount: 7,
		});
		expect(prisma.user.findUnique).toHaveBeenCalledWith({
			where: { handle: "alice.bsky.social" },
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
	});

	it("returns public profile counts from follow aggregates", async () => {
		prisma.user.findUnique = jest.fn().mockResolvedValue({
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

	it("delegates account deletion with the PDS deletion flag", async () => {
		(userDeletionService.deleteUser as jest.Mock).mockResolvedValue(undefined);

		await expect(
			service.deleteUser("did:plc:123", { did: "did:plc:123" }, true),
		).resolves.toBeUndefined();
		expect(userDeletionService.deleteUser).toHaveBeenCalledWith(
			"did:plc:123",
			{ did: "did:plc:123" },
			true,
		);
	});

	it("propagates account deletion failures from PDS cleanup", async () => {
		(userDeletionService.deleteUser as jest.Mock).mockRejectedValue(
			new BadGatewayException(
				"Failed to delete OpnShelf data from your PDS. Your account was not deleted.",
			),
		);

		await expect(
			service.deleteUser("did:plc:123", { did: "did:plc:123" }, true),
		).rejects.toThrow(BadGatewayException);
	});

	it("imports Bluesky follows with pagination and creates only missing local follows", async () => {
		prisma.user.findUnique = jest
			.fn()
			.mockResolvedValueOnce({ did: "did:plc:self" });
		prisma.user.findMany = jest
			.fn()
			.mockResolvedValue([
				{ did: "did:plc:friend-1" },
				{ did: "did:plc:friend-2" },
			]);
		prisma.follow.findMany = jest
			.fn()
			.mockResolvedValue([{ followingDid: "did:plc:friend-2" }]);
		prisma.follow.createMany = jest.fn().mockResolvedValue({ count: 1 });

		global.fetch = jest
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

	it("returns zero counts when no Bluesky follows match OpnShelf users", async () => {
		prisma.user.findUnique = jest
			.fn()
			.mockResolvedValueOnce({ did: "did:plc:self" });
		prisma.user.findMany = jest.fn().mockResolvedValue([]);
		prisma.follow.findMany = jest.fn().mockResolvedValue([]);
		prisma.follow.createMany = jest.fn();

		global.fetch = jest.fn().mockResolvedValue({
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
		prisma.user.findUnique = jest
			.fn()
			.mockResolvedValueOnce({ did: "did:plc:self" });

		global.fetch = jest.fn().mockResolvedValue({
			ok: false,
			status: 503,
			statusText: "Service Unavailable",
		}) as unknown as typeof fetch;

		await expect(service.importBlueskyFollows("did:plc:self")).rejects.toThrow(
			BadGatewayException,
		);
	});

	it("throws when public profile handle is missing", async () => {
		prisma.user.findUnique = jest.fn().mockResolvedValue(null);

		await expect(
			service.getPublicProfileByHandle("nobody.bsky.social"),
		).rejects.toThrow(NotFoundException);
	});

	it("normalizes Trakt movie/episode items and skips unsupported action", async () => {
		const profilePayload = {
			username: "alice",
			name: "Alice Example",
			private: false,
			vip: true,
			ids: { slug: "alice" },
			images: {
				avatar: {
					medium: "//example.com/avatar-medium.jpg",
				},
			},
		};
		const payload = [
			{
				type: "movie",
				action: "watch",
				watched_at: "2026-01-01T01:00:00.000Z",
				movie: { title: "Past Lives", year: 2023, ids: { tmdb: 100 } },
			},
			{
				type: "episode",
				action: "scrobble",
				watched_at: "2026-01-02T02:00:00.000Z",
				show: { title: "Severance", ids: { tmdb: 200 } },
				episode: { season: 1, number: 2, title: "Half Loop" },
			},
			{
				type: "movie",
				action: "rate",
				watched_at: "2026-01-03T03:00:00.000Z",
				movie: { ids: { tmdb: 300 } },
			},
		];

		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => profilePayload,
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => payload,
			}) as unknown as typeof fetch;

		const result = await service.fetchTraktPublicHistory("alice", 100);

		expect(result.profile).toEqual({
			username: "alice",
			slug: "alice",
			name: "Alice Example",
			isPrivate: false,
			isVip: true,
			avatarUrl: "https://example.com/avatar-medium.jpg",
		});
		expect(result.importableCount).toBe(2);
		expect(result.previewItems).toEqual([
			{
				type: "movie",
				title: "Past Lives",
				subtitle: "Movie • 2023",
				watchedAt: "2026-01-01T01:00:00.000Z",
			},
			{
				type: "episode",
				title: "Severance",
				subtitle: "S01E02 • Half Loop",
				watchedAt: "2026-01-02T02:00:00.000Z",
			},
		]);
		expect(result.items).toHaveLength(2);
		expect(result.items[0]).toMatchObject({ type: "movie", movieTmdbId: 100 });
		expect(result.items[1]).toMatchObject({
			type: "episode",
			showTmdbId: 200,
			seasonNumber: 1,
			episodeNumber: 2,
		});
		expect(result.skipped).toHaveLength(1);
		expect(result.skipped[0]?.reason).toBe("unsupported_action");
	});

	it("continues paging when Trakt returns short pages before the last page", async () => {
		const profilePayload = {
			username: "rpf_2001",
			private: false,
			vip: false,
			ids: { slug: "rpf_2001" },
		};
		const firstPage = Array.from({ length: 99 }, (_, index) => ({
			type: "movie",
			action: "watch",
			watched_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
			movie: {
				title: `Movie ${index + 1}`,
				ids: { tmdb: index + 1 },
			},
		}));
		const secondPage = [
			{
				type: "movie",
				action: "watch",
				watched_at: "2026-04-15T00:00:00.000Z",
				movie: { title: "Movie 100", ids: { tmdb: 100 } },
			},
		];

		global.fetch = jest
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				headers: new Headers(),
				json: async () => profilePayload,
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				headers: new Headers({
					"x-pagination-page-count": "2",
				}),
				json: async () => firstPage,
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				headers: new Headers({
					"x-pagination-page-count": "2",
				}),
				json: async () => secondPage,
			}) as unknown as typeof fetch;

		const result = await service.fetchTraktPublicHistory("rpf_2001");

		expect(result.importableCount).toBe(100);
		expect(result.items).toHaveLength(100);
		expect(result.items[result.items.length - 1]).toMatchObject({
			type: "movie",
			movieTmdbId: 100,
		});
	});

	it("returns dedupe skips without dropping rewatches", async () => {
		prisma.trackedMovie.findFirst = jest
			.fn()
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(null);
		moviesService.markWatched = jest.fn().mockResolvedValue({
			uri: "at://movie/1",
			cid: "cid-1",
			rkey: "rkey-1",
		});
		moviesService.indexTrackedMovie = jest.fn().mockResolvedValue({});

		const result = await service.importNormalizedItems(
			"did:plc:abc",
			{ did: "did:plc:abc" },
			[
				{
					type: "movie",
					movieTmdbId: 10,
					watchedAt: "2026-01-01T00:00:00.000Z",
				},
				{
					type: "movie",
					movieTmdbId: 10,
					watchedAt: "2026-01-01T00:00:00.000Z",
				},
				{
					type: "movie",
					movieTmdbId: 10,
					watchedAt: "2026-01-02T00:00:00.000Z",
				},
			],
		);

		expect(moviesService.markWatched).toHaveBeenCalledTimes(2);
		expect(result).toMatchObject({ imported: 2, skipped: 1, failed: 0 });
	});

	it("continues when a write fails", async () => {
		prisma.trackedMovie.findFirst = jest.fn().mockResolvedValue(null);
		moviesService.markWatched = jest
			.fn()
			.mockRejectedValue(new Error("write failed"));

		const result = await service.importNormalizedItems(
			"did:plc:abc",
			{ did: "did:plc:abc" },
			[
				{
					type: "movie",
					movieTmdbId: 10,
					watchedAt: "2026-01-01T00:00:00.000Z",
				},
			],
		);

		expect(result.failed).toBe(1);
		expect(result.errors[0]?.code).toBe("write_failed");
	});

	it("rejects history import payloads larger than 100", async () => {
		await expect(
			service.importNormalizedItems(
				"did:plc:abc",
				{ did: "did:plc:abc" },
				Array.from({ length: 101 }, () => ({
					type: "movie" as const,
					movieTmdbId: 1,
					watchedAt: "2026-01-01T00:00:00.000Z",
				})),
			),
		).rejects.toThrow(BadRequestException);
	});
});
