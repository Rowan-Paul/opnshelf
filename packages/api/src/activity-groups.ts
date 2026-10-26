import type { FollowedActivityItemDto } from "./generated/types.gen";

export type ActivityGroup = {
	id: string;
	day: string;
	label: string;
	items: FollowedActivityItemDto[];
};

/** Group all loaded pages together so bundles spanning pages merge on append. */
export function groupActivities(
	activities: FollowedActivityItemDto[],
	timeZone?: string,
	now = new Date(),
): ActivityGroup[] {
	const dayFormat = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	const today = dayFormat.format(now);
	// Calendar arithmetic in the viewer's zone, including DST transitions.
	const parts = dayFormat.formatToParts(now);
	const part = (type: string) =>
		Number(parts.find((p) => p.type === type)?.value);
	const yesterday = new Date(
		Date.UTC(part("year"), part("month") - 1, part("day") - 1),
	);
	const yesterdayKey = new Intl.DateTimeFormat("en-CA", {
		timeZone: "UTC",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(yesterday);
	const groups = new Map<string, ActivityGroup>();
	const seen = new Set<string>();
	for (const activity of activities
		.flatMap((activity) => activity.episodeWatches ?? [activity])
		.sort(
			(a, b) =>
				b.activityAt.localeCompare(a.activityAt) || b.id.localeCompare(a.id),
		)) {
		if (seen.has(activity.id)) continue;
		seen.add(activity.id);
		const date = new Date(activity.activityAt);
		const day = dayFormat.format(date);
		const id =
			activity.type === "episode" && activity.showId
				? JSON.stringify([activity.actor.did, activity.showId, day])
				: activity.id;
		const existing = groups.get(id);
		if (existing) existing.items.push(activity);
		else
			groups.set(id, {
				id,
				day,
				label:
					day === today
						? "Today"
						: day === yesterdayKey
							? "Yesterday"
							: date.toLocaleDateString("en-US", {
									timeZone,
									month: "long",
									day: "numeric",
									year: "numeric",
								}),
				items: [activity],
			});
	}
	return [...groups.values()];
}
