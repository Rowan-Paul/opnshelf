import { useMemo, useState } from "react";
import ConfirmRemoveDialog from "#/components/ConfirmRemoveDialog";
import ManageListsDialog from "#/components/ManageListsDialog";
import MediaCard from "#/components/MediaCard";
import { useAuth } from "#/lib/auth-context";
import { formatDateTime } from "#/lib/date-utils";
import { useMediaWatchStatus } from "#/lib/hooks";
import { useWatchActions } from "#/lib/hooks/useWatchActions";

interface ActionableMediaCardProps {
	id: string | number;
	title: string;
	displayTitle?: string;
	posterUrl: string;
	backdropUrl?: string;
	type: "movie" | "show";
	rating?: number;
	duration?: string;
	episodeInfo?: string;
	watchedDate?: string;
	seasonNumber?: number;
	episodeNumber?: number;
	role?: string;
	year?: string | number;
	size?: "sm" | "md" | "lg";
	layout?: "poster" | "backdrop";
	interactive?: boolean;
	isWatched?: boolean;
	onRemove?: () => void;
	isRemoving?: boolean;
}

export default function ActionableMediaCard({
	id,
	title,
	displayTitle,
	posterUrl,
	backdropUrl,
	type,
	rating,
	duration,
	episodeInfo,
	watchedDate,
	seasonNumber,
	episodeNumber,
	role,
	year,
	size = "md",
	layout = "poster",
	interactive = true,
	isWatched: isWatchedProp,
	onRemove,
	isRemoving = false,
}: ActionableMediaCardProps) {
	const [listDialogOpen, setListDialogOpen] = useState(false);
	const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

	const { userSettings } = useAuth();
	const userTimezone = userSettings?.timezone;
	const userTimeFormat = userSettings?.timeFormat;

	const formattedWatchedDate = watchedDate
		? formatDateTime(watchedDate, userTimezone, userTimeFormat)
		: undefined;

	const isMovie = type === "movie";
	const mediaId = String(id);
	const isEpisode =
		!isMovie &&
		typeof seasonNumber === "number" &&
		typeof episodeNumber === "number";

	const watchActions = useWatchActions(
		isMovie
			? { mediaType: "movie", movieId: mediaId }
			: { mediaType: "show", showId: mediaId },
	);

	const watchStatusOptions = isMovie
		? ({ mediaType: "movie", movieId: mediaId } as const)
		: ({ mediaType: "show", showId: mediaId } as const);

	const {
		isWatched: queryIsWatched,
		isTracking,
		movieWatchHistory,
		watchHistory,
		isEpisodeWatched,
	} = useMediaWatchStatus(watchStatusOptions);

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
					: (isTracking ?? false);

	const confirmEntryCount = isMovie
		? movieWatchHistory?.length || 0
		: isEpisode
			? episodeWatchHistory.length
			: watchHistory?.length || 0;

	const handleMarkWatched = () => {
		if (isMovie) {
			watchActions.markMovieWatched();
		} else if (
			isEpisode &&
			seasonNumber !== undefined &&
			episodeNumber !== undefined
		) {
			watchActions.markEpisodeWatched(seasonNumber, episodeNumber);
		} else {
			watchActions.markShowWatched();
		}
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
				id={id}
				title={title}
				displayTitle={displayTitle}
				posterUrl={posterUrl}
				backdropUrl={backdropUrl}
				type={type}
				rating={rating}
				duration={duration}
				episodeInfo={episodeInfo}
				watchedDate={formattedWatchedDate}
				seasonNumber={seasonNumber}
				episodeNumber={episodeNumber}
				role={role}
				year={year}
				size={size}
				layout={layout}
				isWatched={watched}
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
			/>
			{interactive && (
				<ManageListsDialog
					mediaType={type}
					mediaId={mediaId}
					seasonNumber={seasonNumber}
					episodeNumber={episodeNumber}
					open={listDialogOpen}
					onOpenChange={setListDialogOpen}
					title={`Add "${title}" to lists`}
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
