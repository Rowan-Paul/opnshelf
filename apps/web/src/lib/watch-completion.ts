import {
	type ShowProgressDto,
	showsControllerGetShowProgress,
} from "@opnshelf/api";
import { celebrateCompletion } from "#/components/completion-confetti";

// Celebration reads must never prevent a Watch from being saved.
export async function readCompletionProgress(showId: string) {
	try {
		const { data } = await showsControllerGetShowProgress({
			query: { showIds: [showId] },
			throwOnError: true,
			signal: AbortSignal.timeout(2000),
		});
		return data.items.find((item) => item.showId === showId);
	} catch {
		return undefined;
	}
}

export function newlyCompleted(
	before: ShowProgressDto | undefined,
	after: ShowProgressDto | undefined,
	seasonNumber?: number,
) {
	if (!before || !after || before.state === "unavailable") return false;
	if (
		before.state !== "complete" &&
		after.state === "complete" &&
		after.episodesTotal > 0
	)
		return true;
	return after.seasons.some(
		(season) =>
			(seasonNumber === undefined || season.seasonNumber === seasonNumber) &&
			season.episodesTotal > 0 &&
			season.state === "complete" &&
			before.seasons.some(
				(old) =>
					old.seasonNumber === season.seasonNumber &&
					old.state !== "complete" &&
					old.state !== "unavailable",
			),
	);
}

export async function celebrateWatchCompletion(
	before: ShowProgressDto | undefined,
	seasonNumber?: number,
) {
	if (!before) return;
	const after = await readCompletionProgress(before.showId);
	if (newlyCompleted(before, after, seasonNumber)) celebrateCompletion();
}
