import { useMemo, useState } from "react";
import ConfirmRemoveDialog from "#/components/ConfirmRemoveDialog";
import { useListItemStatus, useMediaWatchStatus } from "#/lib/hooks";
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
	const {
		type,
		id,
		seasonNumber,
		episodeNumber,
		showId,
		isWatched,
		watchCount,
		title,
		...rest
	} = props;

	const [listDialogOpen, setListDialogOpen] = useState(false);
	const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

	const isMovie = type === "movie";
	const actualShowId = showId || (type === "show" ? String(id) : undefined);

	const watchActions = useWatchActions(
		isMovie
			? { mediaType: "movie", movieId: String(id) }
			: { mediaType: "show", showId: actualShowId || "" },
	);

	const watchStatusOptions = isMovie
		? ({ mediaType: "movie", movieId: String(id) } as const)
		: ({ mediaType: "show", showId: actualShowId || "" } as const);

	const { movieWatchHistory, watchHistory } =
		useMediaWatchStatus(watchStatusOptions);

	const rawMediaId = isMovie ? String(id) : actualShowId || String(id);

	const { isInWatchlist, isInFavorites, otherLists } = useListItemStatus({
		mediaType: type,
		mediaId: String(id),
		seasonNumber,
		episodeNumber,
	});

	const isInAnyList = isInWatchlist || isInFavorites || otherLists.length > 0;

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

	const episodeWatchHistory = useMemo(() => {
		if (isMovie || !watchHistory || !Array.isArray(watchHistory)) return [];
		if (seasonNumber === undefined || episodeNumber === undefined) return [];
		return watchHistory.filter(
			(ep: { seasonNumber: number; episodeNumber: number }) =>
				ep.seasonNumber === seasonNumber && ep.episodeNumber === episodeNumber,
		);
	}, [isMovie, watchHistory, seasonNumber, episodeNumber]);

	const confirmEntryCount = isMovie
		? movieWatchHistory?.length || 0
		: episodeWatchHistory.length;
	// Rows that already know the count (Shelf) pass it; the rest fall back to the
	// viewer's own history so a card watched in-session badges its count too.
	const resolvedWatchCount = watchCount ?? confirmEntryCount;

	const confirmTitle = isMovie
		? title || ""
		: title
			? `${title} S${seasonNumber}E${episodeNumber}`
			: `S${seasonNumber}E${episodeNumber}`;

	const handleUnmarkWatched = () => {
		if (confirmEntryCount > 1) {
			setConfirmRemoveOpen(true);
			return;
		}

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

	const handleConfirmRemove = () => {
		if (isMovie) {
			watchActions.unmarkMovieWatched();
		} else if (
			actualShowId &&
			seasonNumber !== undefined &&
			episodeNumber !== undefined
		) {
			watchActions.unmarkEpisodeWatched(seasonNumber, episodeNumber, "all");
		}
		setConfirmRemoveOpen(false);
	};

	return (
		<>
			<MediaCard
				{...rest}
				id={id}
				title={title}
				type={type}
				seasonNumber={seasonNumber}
				episodeNumber={episodeNumber}
				isWatched={isWatched}
				watchCount={resolvedWatchCount}
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
				isInAnyList={isInAnyList}
			/>
			<ManageListsDialog
				mediaType={type}
				mediaId={rawMediaId}
				seasonNumber={seasonNumber}
				episodeNumber={episodeNumber}
				open={listDialogOpen}
				onOpenChange={setListDialogOpen}
				title={
					isInAnyList
						? `Manage lists for "${title}"`
						: `Add "${title}" to lists`
				}
			/>
			<ConfirmRemoveDialog
				open={confirmRemoveOpen}
				onOpenChange={setConfirmRemoveOpen}
				title={confirmTitle}
				entryCount={confirmEntryCount}
				onConfirm={handleConfirmRemove}
				isPending={
					isMovie
						? watchActions.isUnmarkMoviePending
						: watchActions.isUnmarkEpisodePending
				}
			/>
		</>
	);
}
