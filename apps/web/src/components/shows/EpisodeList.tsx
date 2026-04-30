import { Loader2 } from "lucide-react";
import EpisodeRow, { type Episode } from "./EpisodeRow";

interface EpisodeListProps {
	episodes: Episode[];
	showId: string;
	showName: string;
	seasonNumber: number;
	watchHistory?: Array<{ seasonNumber: number; episodeNumber: number }>;
	nextEpisode?: { seasonNumber: number; episodeNumber: number } | null;
	onMarkEpisode: (seasonNumber: number, episodeNumber: number) => void;
	onUnmarkEpisode: (seasonNumber: number, episodeNumber: number) => void;
	onUnmarkEpisodeAll?: (seasonNumber: number, episodeNumber: number) => void;
	processingEpisode: { seasonNumber: number; episodeNumber: number } | null;
	unmarkingEpisode: { seasonNumber: number; episodeNumber: number } | null;
	isLoading?: boolean;
}

export default function EpisodeList({
	episodes,
	showId,
	showName,
	seasonNumber,
	watchHistory = [],
	nextEpisode = null,
	onMarkEpisode,
	onUnmarkEpisode,
	onUnmarkEpisodeAll,
	processingEpisode,
	unmarkingEpisode,
	isLoading = false,
}: EpisodeListProps) {
	if (isLoading) {
		return (
			<div className="p-4 text-center">
				<Loader2 className="mx-auto h-6 w-6 animate-spin text-(--accent)" />
			</div>
		);
	}

	if (!episodes || episodes.length === 0) {
		return (
			<div className="p-4 text-center text-(--foreground-muted)">
				No episodes available
			</div>
		);
	}

	return (
		<div>
			{episodes.map((episode, index) => {
				const episodeWatchHistory = watchHistory.filter(
					(ep) =>
						ep.seasonNumber === seasonNumber &&
						ep.episodeNumber === episode.episode_number,
				);
				const isWatched = episodeWatchHistory.length > 0;
				const isUpNext =
					nextEpisode?.seasonNumber === seasonNumber &&
					nextEpisode?.episodeNumber === episode.episode_number;

				return (
					<EpisodeRow
						key={episode.id}
						episode={episode}
						showId={showId}
						showName={showName}
						seasonNumber={seasonNumber}
						isWatched={isWatched}
						isUpNext={isUpNext}
						isProcessing={
							processingEpisode?.seasonNumber === seasonNumber &&
							processingEpisode?.episodeNumber === episode.episode_number
						}
						isUnmarking={
							unmarkingEpisode?.seasonNumber === seasonNumber &&
							unmarkingEpisode?.episodeNumber === episode.episode_number
						}
						onMarkWatched={() =>
							onMarkEpisode(seasonNumber, episode.episode_number)
						}
						onUnmarkWatched={() =>
							onUnmarkEpisode(seasonNumber, episode.episode_number)
						}
						onUnmarkAllWatched={
							onUnmarkEpisodeAll
								? () => onUnmarkEpisodeAll(seasonNumber, episode.episode_number)
								: undefined
						}
						watchHistoryCount={episodeWatchHistory.length}
						isLast={index === episodes.length - 1}
					/>
				);
			})}
		</div>
	);
}
