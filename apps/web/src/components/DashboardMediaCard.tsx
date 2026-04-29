import { useState } from "react";
import { useWatchActions } from "#/lib/hooks/useWatchActions";
import ManageListsDialog from "./ManageListsDialog";
import type { MediaCardProps } from "./MediaCard";
import MediaCard from "./MediaCard";

interface DashboardMediaCardProps
	extends Omit<
		MediaCardProps,
		| "onMarkWatched"
		| "onUnmarkWatched"
		| "isMarkWatchedPending"
		| "isUnmarkWatchedPending"
	> {
	showId?: string;
}

export default function DashboardMediaCard(props: DashboardMediaCardProps) {
	const { type, id, seasonNumber, episodeNumber, showId, isWatched, ...rest } =
		props;

	const [listDialogOpen, setListDialogOpen] = useState(false);

	const isMovie = type === "movie";
	const actualShowId = showId || (type === "show" ? String(id) : undefined);

	const watchActions = useWatchActions(
		isMovie
			? { mediaType: "movie", movieId: String(id) }
			: { mediaType: "show", showId: actualShowId || "" },
	);

	const rawMediaId = isMovie ? String(id) : actualShowId || String(id);

	const handleMarkWatched = () => {
		if (isMovie) {
			watchActions.markMovieWatched();
		} else if (
			actualShowId &&
			seasonNumber !== undefined &&
			episodeNumber !== undefined
		) {
			watchActions.markEpisodeWatched(seasonNumber, episodeNumber);
		}
	};

	const handleUnmarkWatched = () => {
		if (isMovie) {
			watchActions.unmarkMovieWatched();
		} else if (
			actualShowId &&
			seasonNumber !== undefined &&
			episodeNumber !== undefined
		) {
			watchActions.unmarkEpisodeWatched(seasonNumber, episodeNumber);
		}
	};

	return (
		<>
			<MediaCard
				{...rest}
				id={id}
				type={type}
				seasonNumber={seasonNumber}
				episodeNumber={episodeNumber}
				isWatched={isWatched}
				onMarkWatched={handleMarkWatched}
				onUnmarkWatched={handleUnmarkWatched}
				onManageLists={() => setListDialogOpen(true)}
				isMarkWatchedPending={
					isMovie
						? watchActions.isMarkMoviePending
						: watchActions.isMarkEpisodePending
				}
				isUnmarkWatchedPending={
					isMovie
						? watchActions.isUnmarkMoviePending
						: watchActions.isUnmarkEpisodePending
				}
			/>
			<ManageListsDialog
				mediaType={type}
				mediaId={rawMediaId}
				seasonNumber={seasonNumber}
				episodeNumber={episodeNumber}
				open={listDialogOpen}
				onOpenChange={setListDialogOpen}
			/>
		</>
	);
}
