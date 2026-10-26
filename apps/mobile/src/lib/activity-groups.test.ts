import type { FollowedActivityItemDto } from "@opnshelf/api";
import { describe, expect, it } from "vitest";
import { groupActivities } from "../../../../packages/api/src/activity-groups";

const actor = {
	did: "alex",
	handle: "alex.test",
	followersCount: 0,
	followingCount: 0,
};
function episode(
	id: string,
	activityAt: string,
	extra: Partial<FollowedActivityItemDto> = {},
): FollowedActivityItemDto {
	return {
		id,
		actor,
		type: "episode",
		showId: "1",
		showTitle: "Severance",
		seasonNumber: 1,
		episodeNumber: 1,
		activityAt,
		createdAt: activityAt,
		...extra,
	};
}

describe("daily Activity Feed bundles", () => {
	it("merges pages and rewatches while keeping Users, shows, movies and Reviews separate", () => {
		const older = episode("old", "2026-10-25T09:00:00.000Z");
		const latest = episode("latest", "2026-10-25T10:00:00.000Z");
		const review = episode("review", "2026-10-25T09:30:00.000Z", {
			type: "review",
		});
		const groups = groupActivities(
			[
				older,
				review,
				latest,
				older,
				episode("other-show", older.activityAt, { showId: "2" }),
				episode("other-user", older.activityAt, {
					actor: { ...actor, did: "sam" },
				}),
				episode("movie", older.activityAt, { type: "movie", movieId: "1" }),
			],
			"Europe/Amsterdam",
			new Date(latest.activityAt),
		);
		expect(groups).toHaveLength(5);
		expect(groups[0].items.map((item) => item.id)).toEqual(["latest", "old"]);
		expect(groups[0].label).toBe("Today");
		expect(groups[1].items).toEqual([review]);
		expect(groupActivities([older], "UTC")[0].id).toBe(
			groupActivities([older, latest], "UTC")[0].id,
		);
	});

	it("uses viewer calendar days across midnight and DST, including Yesterday", () => {
		const now = new Date("2026-03-09T05:00:00.000Z");
		const groups = groupActivities(
			[
				episode("today", now.toISOString()),
				episode("yesterday", "2026-03-08T05:30:00.000Z"),
				episode("earlier", "2026-03-08T04:30:00.000Z"),
			],
			"America/New_York",
			now,
		);
		expect(groups.map((g) => g.label)).toEqual([
			"Today",
			"Yesterday",
			"March 7, 2026",
		]);
	});

	it("expands complete server bundles and keeps a bundle's newest Watch first", () => {
		const first = episode("a", "2026-10-25T10:00:00.000Z");
		const second = episode("b", "2026-10-25T11:00:00.000Z");
		const groups = groupActivities(
			[{ ...second, id: "bundle", episodeWatches: [first, second] }],
			"UTC",
		);
		expect(groups[0].items.map((item) => item.id)).toEqual(["b", "a"]);
	});
});
