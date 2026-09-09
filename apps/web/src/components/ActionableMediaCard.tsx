import { useMemo, useState } from "react";
import ConfirmDialog from "#/components/ConfirmDialog";
import ConfirmRemoveDialog from "#/components/ConfirmRemoveDialog";
import ManageListsDialog from "#/components/ManageListsDialog";
import MediaCard from "#/components/MediaCard";
import { useAuth } from "#/lib/auth-context";
import { formatDateTime } from "#/lib/date-utils";
import {
	useListItemStatus,
	useMediaWatchStatus,
	useShowProgressForShow,
} from "#/lib/hooks";
import { useWatchActions } from "#/lib/hooks/useWatchActions";

interface ActionableMediaCardProps {
	id: string | number;
	title: string;
	displayTitle?: string;
	posterUrl: string;
	imageLoading?: "eager" | "lazy";
	backdropUrl?: string;
	type: "movie" | "show";
	tmdbRating?: number;
	globalRating?: number;
	userRating?: number;
	duration?: string;
	episodeInfo?: string;
	watchedDate?: string;
	undatedWatch?: boolean;
	seasonNumber?: number;
	episodeNumber?: number;
	role?: string;
	year?: string | number;
	size?: "sm" | "md" | "lg";
	fill?: boolean;
	layout?: "poster" | "backdrop";
	interactive?: boolean;
	isWatched?: boolean;
	watchCount?: number;
	onRemove?: () => void;
	isRemoving?: boolean;
}

export default function ActionableMediaCard({
	id,
	title,
	displayTitle,
	posterUrl,
	imageLoading,
	backdropUrl,
	type,
	tmdbRating,
	globalRating,
	userRating,
	duration,
	episodeInfo,
	watchedDate,
	undatedWatch = false,
	seasonNumber,
	episodeNumber,
	role,
	year,
	size = "md",
	fill = false,
	layout = "poster",
	interactive = true,
	isWatched: isWatchedProp,
	watchCount,
	onRemove,
	isRemoving = false,
}: ActionableMediaCardProps) {
	const [listDialogOpen, setListDialogOpen] = useState(false);
	const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
	const [confirmRemainingOpen, setConfirmRemainingOpen] = useState(false);

	const { userSettings } = useAuth();
	const userTimezone = userSettings?.timezone;
	const userTimeFormat = userSettings?.timeFormat;

	const formattedWatchedDate = watchedDate
		? formatDateTime(watchedDate, userTimezone, userTimeFormat)
		: undatedWatch
			? "No date"
			: undefined;

	const isMovie = type === "movie";
	const mediaId = String(id);
	const isEpisode =
		!isMovie &&
		typeof seasonNumber === "number" &&
		typeof episodeNumber === "number";

	const { isInWatchlist, isInFavorites, otherLists } = useListItemStatus({
		mediaType: type,
		mediaId: String(id),
		seasonNumber,
		episodeNumber,
	});

	const isInAnyList = isInWatchlist || isInFavorites || otherLists.length > 0;

	const watchActions = useWatchActions(
		isMovie
			? { mediaType: "movie", movieId: mediaId }
			: { mediaType: "show", showId: mediaId },
	);

	const watchStatusOptions = isMovie
		? ({ mediaType: "movie", movieId: mediaId } as const)
		: ({
				mediaType: "show",
				showId: mediaId,
				skipHistory: !isEpisode,
			} as const);

	const {
		isWatched: queryIsWatched,
		movieWatchHistory,
		watchHistory,
		isEpisodeWatched,
	} = useMediaWatchStatus(watchStatusOptions);
	const progressQuery = useShowProgressForShow(mediaId, !isMovie && !isEpisode);
	const showProgress = progressQuery.data?.items.find(
		(item) => item.showId === mediaId,
	);
	const isPartialShow =
		!isMovie && !isEpisode && showProgress?.state === "partial";
	const isCompleteShow =
		!isMovie && !isEpisode && showProgress?.state === "complete";
	const isProgressUnavailable =
		progressQuery.isError || showProgress?.state === "unavailable";

	const episodeWatchHistory = useMemo(() => {
		if (isMovie || !watchHistory || !Array.isArray(watchHistory)) return [];
		if (seasonNumber === undefined || episodeNumber === undefined) return [];
		return watchHistory.filter(
			(ep: { seasonNumber: number; episodeNumber: number }) =>
				ep.seasonNumber === seasonNumber && ep.episodeNumber === episodeNumber,
		);
	}, [isMovie, watchHistory, seasonNumber, episodeNumber]);

	const watched =
		isWatchedProp !== undefined
			? isWatchedProp
			: isMovie
				? (queryIsWatched ?? false)
				: isEpisode
					? (isEpisodeWatched?.(seasonNumber, episodeNumber) ?? false)
					: isCompleteShow;

	// How many Watch records unmarking would delete. For a whole show that's
	// every episode Watch behind the card, which is what the confirm dialog
	// needs to say.
	const confirmEntryCount = isMovie
		? movieWatchHistory?.length || 0
		: isEpisode
			? episodeWatchHistory.length
			: 0;
	// What the badge states. Only movies and episodes are Watched; a show is
	// tracked through its episodes, so "watched N times" is not a quantity it
	// has — `confirmEntryCount` there counts episodes, a different thing.
	const resolvedWatchCount =
		watchCount ?? (isMovie || isEpisode ? confirmEntryCount : undefined);

	const handleMarkWatched = () => {
		if (isMovie) {
			watchActions.markMovieWatched();
		} else if (
			isEpisode &&
			seasonNumber !== undefined &&
			episodeNumber !== undefined
		) {
			watchActions.markEpisodeWatched(seasonNumber, episodeNumber);
		} else if (isPartialShow) {
			setConfirmRemainingOpen(true);
		} else {
			watchActions.markShowWatched();
		}
	};

	const handleConfirmRemaining = () => {
		watchActions.markShowWatched();
		setConfirmRemainingOpen(false);
	};

	const handleUnmarkWatched = () => {
		if (confirmEntryCount > 1) {
			setConfirmRemoveOpen(true);
			return;
		}

		if (isMovie) {
			watchActions.unmarkMovieWatched();
		} else if (
			isEpisode &&
			seasonNumber !== undefined &&
			episodeNumber !== undefined
		) {
			watchActions.unmarkEpisodeWatched(seasonNumber, episodeNumber);
		} else {
			watchActions.unmarkShowWatched();
		}
	};

	const handleConfirmRemove = () => {
		if (isMovie) {
			watchActions.unmarkMovieWatched();
		} else if (
			isEpisode &&
			seasonNumber !== undefined &&
			episodeNumber !== undefined
		) {
			watchActions.unmarkEpisodeWatched(seasonNumber, episodeNumber, "all");
		} else {
			watchActions.unmarkShowWatched();
		}
		setConfirmRemoveOpen(false);
	};

	return (
		<>
			<MediaCard
				imageLoading={imageLoading}
				id={id}
				title={title}
				displayTitle={displayTitle}
				posterUrl={posterUrl}
				backdropUrl={backdropUrl}
				type={type}
				tmdbRating={tmdbRating}
				globalRating={globalRating}
				userRating={userRating}
				duration={duration}
				episodeInfo={episodeInfo}
				watchedDate={formattedWatchedDate}
				seasonNumber={seasonNumber}
				episodeNumber={episodeNumber}
				role={role}
				year={year}
				size={size}
				fill={fill}
				layout={layout}
				isWatched={watched}
				watchCount={resolvedWatchCount}
				episodeProgress={
					isPartialShow
						? {
								watched: showProgress.episodesWatched,
								total: showProgress.episodesTotal,
								percentage: showProgress.percentage,
							}
						: undefined
				}
				isProgressLoading={!isMovie && !isEpisode && progressQuery.isLoading}
				isProgressUnavailable={!isMovie && !isEpisode && isProgressUnavailable}
				onMarkWatched={interactive ? handleMarkWatched : undefined}
				onUnmarkWatched={interactive ? handleUnmarkWatched : undefined}
				onManageLists={
					interactive && !onRemove ? () => setListDialogOpen(true) : undefined
				}
				onRemove={onRemove}
				isRemoving={isRemoving}
				isMarkWatchedPending={
					isMovie
						? watchActions.isMarkMoviePending
						: isEpisode
							? watchActions.isMarkEpisodePending
							: watchActions.isMarkShowPending
				}
				isUnmarkWatchedPending={
					isMovie
						? watchActions.isUnmarkMoviePending
						: isEpisode
							? watchActions.isUnmarkEpisodePending
							: watchActions.isUnmarkShowPending
				}
				isInAnyList={isInAnyList}
			/>
			{interactive && (
				<ManageListsDialog
					mediaType={type}
					mediaId={mediaId}
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
			)}
			{interactive && (
				<ConfirmDialog
					open={confirmRemainingOpen}
					onOpenChange={setConfirmRemainingOpen}
					title="Mark remaining episodes watched?"
					description={`This will add Watches for the ${showProgress?.remainingEpisodes ?? 0} remaining aired episodes of ${displayTitle || title}.`}
					confirmLabel="Mark remaining"
					onConfirm={handleConfirmRemaining}
					isPending={watchActions.isMarkShowPending}
					variant="default"
				/>
			)}
			{interactive && (
				<ConfirmRemoveDialog
					open={confirmRemoveOpen}
					onOpenChange={setConfirmRemoveOpen}
					title={displayTitle || title}
					entryCount={confirmEntryCount}
					onConfirm={handleConfirmRemove}
					isPending={
						isMovie
							? watchActions.isUnmarkMoviePending
							: isEpisode
								? watchActions.isUnmarkEpisodePending
								: watchActions.isUnmarkShowPending
					}
				/>
			)}
		</>
	);
}
