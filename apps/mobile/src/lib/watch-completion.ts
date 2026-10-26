import {
	type ShowProgressBatchResponseDto,
	type ShowProgressDto,
	showsControllerGetShowProgress,
} from "@opnshelf/api";
import { hashKey, type QueryClient } from "@tanstack/react-query";
import { celebrateCompletion } from "@/components/completion-confetti";
import { isConfettiEnabled } from "@/lib/confetti-preference";

// Cosmetic work must never add a request to the Watch-save path. Missing or
// invalidated progress skips the celebration; the Watch still saves immediately.
export function cachedCompletionProgress(
	queryClient: QueryClient,
	showId: string,
	viewerDid: string | undefined,
): ShowProgressDto | undefined {
	if (!viewerDid) return undefined;
	const queries = queryClient.getQueryCache().findAll({
		predicate: (query) => {
			const key = query.queryKey[0] as { _id?: string } | undefined;
			return (
				key?._id === "showsControllerGetShowProgress" &&
				query.queryHash === hashKey([...query.queryKey, viewerDid]) &&
				query.state.status === "success" &&
				!query.state.isInvalidated
			);
		},
	});
	let latestProgress: ShowProgressDto | undefined;
	let latestUpdatedAt = -Infinity;
	for (const query of queries) {
		if (query.state.dataUpdatedAt <= latestUpdatedAt) continue;
		const data = query.state.data as ShowProgressBatchResponseDto;
		const progress = data.items.find((item) => item.showId === showId);
		if (progress) {
			latestProgress = progress;
			latestUpdatedAt = query.state.dataUpdatedAt;
		}
	}
	return latestProgress;
}

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
	if (!before || !(await isConfettiEnabled())) return;
	const after = await readCompletionProgress(before.showId);
	if (newlyCompleted(before, after, seasonNumber)) celebrateCompletion();
}
