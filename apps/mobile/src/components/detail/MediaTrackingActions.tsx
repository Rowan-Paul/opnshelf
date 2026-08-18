import { Link } from "expo-router";
import { Calendar, Check, ChevronRight, Plus, X } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { WatchDatePickerModal } from "@/components/detail/WatchDatePickerModal";
import {
	type WatchHistoryEntry,
	WatchHistorySheet,
} from "@/components/detail/WatchHistorySheet";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useWatchActions } from "@/lib/use-watch-actions";
import { useWatchStatus } from "@/lib/use-watch-status";
import { formatWatchDateTime, latestWatchDate } from "@/lib/watch-date";

type MediaTrackingActionsProps =
	| { mediaType: "movie"; movieId: string }
	| { mediaType: "show"; showId: string; episodeCount?: number }
	| {
			mediaType: "season";
			showId: string;
			seasonNumber: number;
			episodeCount: number;
	  }
	| {
			mediaType: "episode";
			showId: string;
			seasonNumber: number;
			episodeNumber: number;
	  };

/**
 * The shared "shelf" split button for every media detail surface — movie, show,
 * season and episode. The primary action toggles the item on/off the shelf
 * ("Add to shelf" / "Remove from shelf"); the trailing calendar button adds it
 * with a custom date (and, for movies, logs an extra watch while already on the
 * shelf). When on the shelf it surfaces a small status card with the relevant
 * progress detail. Watch state is read via `useWatchStatus`; writes go through
 * the optimistic mutations in `useWatchActions`. Mirrors the web "Add to shelf"
 * controls so the wording matches across surfaces.
 */
export function MediaTrackingActions(props: MediaTrackingActionsProps) {
	const { isAuthenticated } = useAuth();
	const [datePickerVisible, setDatePickerVisible] = useState(false);
	const [historyVisible, setHistoryVisible] = useState(false);

	const isMovie = props.mediaType === "movie";
	const showId = props.mediaType === "movie" ? "" : props.showId;

	const status = useWatchStatus(
		isMovie
			? { mediaType: "movie", movieId: props.movieId }
			: { mediaType: "show", showId },
	);
	const actions = useWatchActions(
		isMovie
			? { mediaType: "movie", movieId: props.movieId }
			: { mediaType: "show", showId },
	);

	const showHistory = status.showWatchHistory ?? [];

	let isOnShelf = false;
	let detail: string | undefined;
	switch (props.mediaType) {
		case "movie": {
			isOnShelf = !!status.isWatched;
			const date = formatWatchDateTime(status.latestWatchedDate);
			detail = date
				? `${date}${status.totalMovieWatches > 1 ? ` · ${status.totalMovieWatches} watches` : ""}`
				: undefined;
			break;
		}
		case "show": {
			isOnShelf = !!status.isTracking;
			detail =
				status.uniqueEpisodesWatched > 0
					? `${status.uniqueEpisodesWatched} episode${status.uniqueEpisodesWatched === 1 ? "" : "s"} watched`
					: undefined;
			break;
		}
		case "season": {
			isOnShelf =
				status.isSeasonFullyWatched?.(props.seasonNumber, props.episodeCount) ??
				false;
			const watchedInSeason = new Set(
				showHistory
					.filter((ep) => ep.seasonNumber === props.seasonNumber)
					.map((ep) => `${ep.seasonNumber}-${ep.episodeNumber}`),
			).size;
			detail = `${watchedInSeason} / ${props.episodeCount} episodes watched`;
			break;
		}
		case "episode": {
			isOnShelf =
				status.isEpisodeWatched?.(props.seasonNumber, props.episodeNumber) ??
				false;
			const watchedDate = formatWatchDateTime(
				latestWatchDate(
					showHistory.filter(
						(ep) =>
							ep.seasonNumber === props.seasonNumber &&
							ep.episodeNumber === props.episodeNumber,
					),
				),
			);
			detail = watchedDate ? `Watched ${watchedDate}` : undefined;
			break;
		}
	}

	const isMarkPending =
		props.mediaType === "movie"
			? actions.isMarkMoviePending
			: props.mediaType === "show"
				? actions.isMarkShowPending
				: props.mediaType === "season"
					? actions.isMarkSeasonPending
					: actions.isMarkEpisodePending;
	const isUnmarkPending =
		props.mediaType === "movie"
			? actions.isUnmarkMoviePending
			: props.mediaType === "show"
				? actions.isUnmarkShowPending
				: props.mediaType === "season"
					? actions.isUnmarkSeasonPending
					: actions.isUnmarkEpisodePending;

	const isPending = isMarkPending || isUnmarkPending;

	// Movies and episodes can hold multiple plays, so they expose a manageable
	// watch history (list + per-entry delete); shows/seasons stay binary.
	const canManageHistory =
		props.mediaType === "movie" || props.mediaType === "episode";
	let historyEntries: WatchHistoryEntry[] = [];
	let historySubtitle: string | undefined;
	if (props.mediaType === "movie") {
		historyEntries = (status.movieWatchHistory ?? []).map((e) => ({
			id: e.id,
			watchedDate: e.watchedDate,
		}));
	} else if (props.mediaType === "episode") {
		historyEntries = showHistory
			.filter(
				(e) =>
					e.seasonNumber === props.seasonNumber &&
					e.episodeNumber === props.episodeNumber,
			)
			.map((e) => ({ id: e.id, watchedDate: e.watchedDate }));
		historySubtitle = `S${props.seasonNumber}E${props.episodeNumber}`;
	}
	const deleteHistoryEntry = (id: string) => {
		if (props.mediaType === "movie") actions.deleteMovieWatchHistoryEntry(id);
		else if (props.mediaType === "episode")
			actions.deleteEpisodeWatchHistoryEntry(id);
	};
	const isDeletingHistoryEntry =
		props.mediaType === "movie"
			? actions.isDeleteMovieEntryPending
			: actions.isDeleteEpisodeEntryPending;

	const addToShelf = (watchedAt?: string) => {
		switch (props.mediaType) {
			case "movie":
				actions.markMovieWatched(watchedAt);
				break;
			case "show":
				actions.markShowWatched(watchedAt, props.episodeCount);
				break;
			case "season":
				actions.markSeasonWatched(
					props.seasonNumber,
					watchedAt,
					props.episodeCount,
				);
				break;
			case "episode":
				actions.markEpisodeWatched(
					props.seasonNumber,
					props.episodeNumber,
					watchedAt,
				);
				break;
		}
	};

	const removeFromShelf = () => {
		switch (props.mediaType) {
			case "movie":
				actions.unmarkMovieWatched();
				break;
			case "show":
				actions.unmarkShowWatched();
				break;
			case "season":
				actions.unmarkSeasonWatched(props.seasonNumber);
				break;
			case "episode":
				actions.unmarkEpisodeWatched(
					props.seasonNumber,
					props.episodeNumber,
					"all",
				);
				break;
		}
	};

	const handleDateConfirm = (iso: string) => {
		setDatePickerVisible(false);
		addToShelf(iso);
	};

	if (!isAuthenticated) {
		return (
			<View className="px-4">
				<Link href="/login" asChild>
					<Pressable className="items-center rounded-lg bg-primary py-3">
						<Text className="font-semibold text-primary-foreground">
							Sign in to add to shelf
						</Text>
					</Pressable>
				</Link>
			</View>
		);
	}

	// Movies can be logged multiple times, so keep the date picker available even
	// once on the shelf. The other types are binary, so hide it when on the shelf.
	const showCalendar = !isOnShelf || isMovie;

	return (
		<View className="gap-3 px-4">
			{isOnShelf ? (
				<Pressable
					onPress={canManageHistory ? () => setHistoryVisible(true) : undefined}
					disabled={!canManageHistory}
					className="flex-row items-center gap-2 rounded-xl border border-border bg-card p-3"
				>
					<View className="rounded-full bg-primary/20 p-1.5">
						<Check color="#22c55e" size={16} />
					</View>
					<View className="flex-1">
						<Text className="font-semibold text-foreground text-sm">
							On shelf
						</Text>
						{detail ? (
							<Text className="text-muted-foreground text-xs">{detail}</Text>
						) : null}
					</View>
					{canManageHistory ? <ChevronRight color="#94a3b8" size={18} /> : null}
				</Pressable>
			) : null}

			<View className="flex-row gap-2">
				<Pressable
					onPress={() => (isOnShelf ? removeFromShelf() : addToShelf())}
					disabled={isPending}
					accessibilityState={{ busy: isPending }}
					className={
						isOnShelf
							? "flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-border bg-card py-3"
							: "flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-primary py-3"
					}
					style={{ opacity: isPending ? 0.7 : 1 }}
				>
					{isPending ? (
						<>
							<ActivityIndicator
								size="small"
								color={isOnShelf ? "#94a3b8" : "#3f2e00"}
							/>
							<Text
								className={
									isOnShelf
										? "font-semibold text-foreground"
										: "font-semibold text-primary-foreground"
								}
							>
								{isUnmarkPending ? "Removing…" : "Adding…"}
							</Text>
						</>
					) : isOnShelf ? (
						<>
							<X color="#ef4444" size={18} />
							<Text className="font-semibold text-foreground">
								Remove from shelf
							</Text>
						</>
					) : (
						<>
							<Plus color="#3f2e00" size={18} strokeWidth={2.5} />
							<Text className="font-semibold text-primary-foreground">
								Add to shelf
							</Text>
						</>
					)}
				</Pressable>
				{showCalendar ? (
					<Pressable
						onPress={() => setDatePickerVisible(true)}
						disabled={isPending}
						className="items-center justify-center rounded-lg border border-border px-4"
					>
						<Calendar color="#94a3b8" size={20} />
					</Pressable>
				) : null}
			</View>

			<WatchDatePickerModal
				visible={datePickerVisible}
				onDismiss={() => setDatePickerVisible(false)}
				onConfirm={handleDateConfirm}
				isLoading={isMarkPending}
			/>

			{canManageHistory ? (
				<WatchHistorySheet
					visible={historyVisible}
					onDismiss={() => setHistoryVisible(false)}
					title={historySubtitle}
					entries={historyEntries}
					onDelete={deleteHistoryEntry}
					isDeleting={isDeletingHistoryEntry}
					onAddWatch={() => {
						setHistoryVisible(false);
						setDatePickerVisible(true);
					}}
				/>
			) : null}
		</View>
	);
}
