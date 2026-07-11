import EpisodeRow, { type Episode } from "./EpisodeRow";

const SKELETON_ROWS = Array.from({ length: 4 }, (_, i) => i);

function EpisodeRowSkeleton({ isLast }: { isLast: boolean }) {
	return (
		<div
			className={`flex items-center gap-4 p-4 ${
				!isLast ? "border-(--border) border-b" : ""
			}`}
		>
			<div className="size-10 shrink-0 animate-pulse rounded-lg bg-(--background-subtle)" />
			<div className="min-w-0 flex-1 space-y-2">
				<div className="h-4 w-2/5 animate-pulse rounded bg-(--background-subtle)" />
				<div className="h-3 w-1/4 animate-pulse rounded bg-(--background-subtle)" />
			</div>
			<div className="h-8 w-24 shrink-0 animate-pulse rounded-md bg-(--background-subtle)" />
		</div>
	);
}

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
			<div>
				{SKELETON_ROWS.map((i) => (
					<EpisodeRowSkeleton key={i} isLast={i === SKELETON_ROWS.length - 1} />
				))}
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
