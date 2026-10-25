import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../generated/client";
import type { PrismaService } from "../prisma/prisma.service";
import { ActivityFeedService } from "./activity-feed.service";
import { CirclesService } from "./circles.service";
import { SocialUsersService } from "./social-users.service";

// Opt-in against a disposable local database; never use backend/.env.
const url = process.env.SOCIAL_TEST_DATABASE_URL;
if (url && !["127.0.0.1", "localhost"].includes(new URL(url).hostname))
	throw new Error("Social integration tests require a local database");

describe.skipIf(!url)("daily Activity Feed bundles on PostgreSQL", () => {
	const db = new PrismaClient({
		adapter: new PrismaPg({ connectionString: url }),
	});
	const prisma = db as unknown as PrismaService;
	const users = new SocialUsersService(prisma);
	const circles = new CirclesService(prisma, users);
	const service = new ActivityFeedService(prisma, users, circles);
	const prefix = `activity-test-${randomUUID()}`;
	const viewer = `${prefix}-viewer`,
		alex = `${prefix}-alex`,
		sam = `${prefix}-sam`,
		hidden = `${prefix}-private`;
	const show = `${prefix}-show`,
		otherShow = `${prefix}-other`;
	const record = (rkey: string) => ({
		rkey,
		uri: `at://fixture/${rkey}`,
		cid: "fixture",
	});
	let circleId: string;

	beforeAll(async () => {
		await db.user.createMany({
			data: [viewer, alex, sam, hidden].map((did) => ({
				did,
				handle: `${did}.test`,
				timezone: "America/New_York",
				watchVisibility: did === hidden ? "private" : "public",
			})),
		});
		await db.show.createMany({
			data: [show, otherShow].map((showId) => ({ showId, title: showId })),
		});
		await db.follow.createMany({
			data: [alex, sam, hidden].map((followingDid) => ({
				followerDid: viewer,
				followingDid,
				...record(followingDid),
			})),
		});
		const circle = await db.circle.create({
			data: {
				ownerDid: viewer,
				name: "Alex",
				members: { create: { followerDid: viewer, followingDid: alex } },
			},
		});
		circleId = circle.id;
		await db.trackedEpisode.createMany({
			data: [
				// All eight Watches belong to March 8 in New York, even after UTC midnight.
				...Array.from({ length: 8 }, (_, i) => ({
					userDid: alex,
					showId: show,
					seasonNumber: 1,
					episodeNumber: (i % 4) + 1,
					...record(`watch-${i}`),
					watchedDate: new Date(Date.UTC(2026, 2, 9, 3, 50 - i)),
				})),
				{
					userDid: alex,
					showId: show,
					seasonNumber: 1,
					episodeNumber: 9,
					...record("next-day"),
					watchedDate: new Date("2026-03-09T04:01:00Z"),
				},
				{
					userDid: sam,
					showId: show,
					seasonNumber: 1,
					episodeNumber: 1,
					...record("sam"),
					watchedDate: new Date("2026-03-09T03:30:00Z"),
				},
				{
					userDid: alex,
					showId: otherShow,
					seasonNumber: 1,
					episodeNumber: 1,
					...record("other-show"),
					watchedDate: new Date("2026-03-09T03:20:00Z"),
				},
				{
					userDid: hidden,
					showId: show,
					seasonNumber: 1,
					episodeNumber: 1,
					...record("private"),
					watchedDate: new Date("2026-03-09T05:00:00Z"),
				},
				{
					userDid: alex,
					showId: show,
					seasonNumber: 1,
					episodeNumber: 1,
					...record("no-date"),
					watchedDate: null,
				},
			],
		});
		await db.review.create({
			data: {
				userDid: alex,
				...record("review"),
				mediaType: "episode",
				mediaId: show,
				seasonNumber: 1,
				episodeNumber: 1,
				title: "Review",
				markdown: "Keep this separate",
				createdAt: new Date("2026-03-09T03:49:30Z"),
			},
		});
	});
	afterAll(async () => {
		await db.user.deleteMany({
			where: { did: { in: [viewer, alex, sam, hidden] } },
		});
		await db.show.deleteMany({ where: { showId: { in: [show, otherShow] } } });
		await db.$disconnect();
	});

	it("paginates complete bundles, counts rewatches, and preserves privacy and Circle filters", async () => {
		const first = await service.getFollowedActivityFeed(
			viewer,
			1,
			1,
			undefined,
			"day",
		);
		expect(first).toMatchObject({ total: 5, totalPages: 5, hasNextPage: true });
		expect(first.items[0].episodeWatches).toHaveLength(1);
		const second = await service.getFollowedActivityFeed(
			viewer,
			2,
			1,
			undefined,
			"day",
		);
		expect(second.items).toHaveLength(1);
		expect(second.items[0].episodeWatches).toHaveLength(8);
		expect(second.items[0].activityAt).toBe("2026-03-09T03:50:00.000Z");
		const third = await service.getFollowedActivityFeed(
			viewer,
			3,
			1,
			undefined,
			"day",
		);
		expect(third.items[0].type).toBe("review");
		expect(third.items[0].episodeWatches).toBeUndefined();
		const circle = await service.getFollowedActivityFeed(
			viewer,
			1,
			25,
			circleId,
			"day",
		);
		expect(circle.total).toBe(4);
		expect(circle.items.every((item) => item.actor.did === alex)).toBe(true);
		const legacy = await service.getFollowedActivityFeed(viewer, 1, 25);
		expect(legacy.total).toBe(12);
		expect(
			legacy.items.every((item) => item.episodeWatches === undefined),
		).toBe(true);
	});
});
