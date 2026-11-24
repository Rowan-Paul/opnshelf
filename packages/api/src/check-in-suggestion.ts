import type { QueryClient } from "@tanstack/react-query";
import {
	moviesControllerGetMovieWatchHistoryOptions,
	moviesControllerGetWatchSuggestionOptions,
	showsControllerGetEpisodeDetailsOptions,
	showsControllerGetShowDetailsOptions,
	showsControllerGetShowWatchHistoryOptions,
} from "./generated/@tanstack/react-query.gen";
import type { WatchingCheckInDto } from "./generated/types.gen";

export async function getCheckInSuggestion(
	client: QueryClient,
	completed: WatchingCheckInDto,
) {
	const {
		userDid,
		mediaId: showId,
		startedAt,
		seasonNumber,
		episodeNumber,
	} = completed;
	if (seasonNumber == null || episodeNumber == null) {
		const history = await client.fetchQuery({
			...moviesControllerGetMovieWatchHistoryOptions({
				path: { userDid, movieId: completed.mediaId },
			}),
			staleTime: 0,
		});
		if (!history.some((entry) => entry.watchedDate === startedAt)) return null;
		const { suggestion } = await client.fetchQuery(
			moviesControllerGetWatchSuggestionOptions({
				path: { movieId: completed.mediaId },
			}),
		);
		return suggestion
			? { ...suggestion, artworkPath: suggestion.posterPath }
			: null;
	}

	const history = await client.fetchQuery({
		...showsControllerGetShowWatchHistoryOptions({ path: { userDid, showId } }),
		staleTime: 0,
	});
	if (
		!history.some(
			(entry) =>
				entry.seasonNumber === seasonNumber &&
				entry.episodeNumber === episodeNumber &&
				entry.watchedDate === startedAt,
		)
	)
		return null;

	const current = await client.fetchQuery(
		showsControllerGetEpisodeDetailsOptions({
			path: {
				showId,
				seasonNumber: String(seasonNumber),
				episodeNumber: String(episodeNumber),
			},
		}),
	);
	const next = current._context?.next;
	if (!next) return null;

	const episode = await client.fetchQuery(
		showsControllerGetEpisodeDetailsOptions({
			path: {
				showId,
				seasonNumber: String(next.seasonNumber),
				episodeNumber: String(next.episodeNumber),
			},
		}),
	);
	const airDate = Date.parse(episode.air_date ?? "");
	if (!Number.isFinite(airDate) || airDate > Date.now()) return null;

	const show = await client
		.fetchQuery(showsControllerGetShowDetailsOptions({ path: { showId } }))
		.catch(() => undefined);
	return {
		kind: "episode" as const,
		target: { mediaId: showId, ...next },
		title: episode.name,
		showName: show?.name,
		artworkPath: episode.still_path,
		runtime: episode.runtime,
	};
}
