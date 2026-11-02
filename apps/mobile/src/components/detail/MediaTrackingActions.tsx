import { usersControllerGetMySettingsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { type Href, Link } from "expo-router";
import { Check, ChevronRight, Play, Plus, X } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { Pressable, View } from "react-native";
import { WatchDatePickerModal } from "@/components/detail/WatchDatePickerModal";
import {
	type WatchHistoryEntry,
	WatchHistorySheet,
} from "@/components/detail/WatchHistorySheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useConfirmRemoveWatches } from "@/lib/use-confirm-remove-watches";
import { useWatchActions } from "@/lib/use-watch-actions";
import { useWatchStatus } from "@/lib/use-watch-status";
import { formatWatchDateTime, latestWatchDate } from "@/lib/watch-date";
import { useThemeColors } from "@/theme/colors";

type MediaTrackingActionsProps = TrackingTarget & {
	/**
	 * Buttons placed after the shelf button, in its row. `addWithDate` opens
	 * the date picker; it is undefined when signed out, and when a binary type
	 * (show, season, episode) is already on the shelf.
	 */
	renderTrailing: (addWithDate?: () => void) => ReactNode;
};

export type TrackingTarget =
	/** `title` names the item in the remove-all-Watches confirmation. */
	| { mediaType: "movie"; movieId: string; title?: string }
	| {
			mediaType: "show";
			showId: string;
			episodeCount?: number;
			progress?: {
				state: "unwatched" | "partial" | "complete" | "unavailable";
				episodesWatched: number;
				episodesTotal: number;
			};
			/** Leads the cluster with the episode to watch next, as the Web App's
			 *  "Continue S2E1" does; the shelf button then steps down to secondary.
			 *  `loading` reserves its space until the destination is known. */
			continueTo?: { label: string; href: Href } | "loading";
	  }
	| {
			mediaType: "season";
			showId: string;
			seasonNumber: number;
			episodeCount: number;
			progress?: {
				state: "unwatched" | "partial" | "complete" | "unavailable";
				episodesWatched: number;
				episodesTotal: number;
			};
			/** Same as the show variant: the season's next episode. */
			continueTo?: { label: string; href: Href } | "loading";
	  }
	| {
			mediaType: "episode";
			showId: string;
			seasonNumber: number;
			episodeNumber: number;
			title?: string;
	  };

/**
 * The shared "shelf" button for every media detail surface — movie, show,
 * season and episode. The primary action toggles the item on/off the shelf
 * ("Add to shelf" / "Remove from shelf"); `renderTrailing` fills the rest of
 * its row and gets the "Add with date" opener, which adds it with a custom
 * date (and, for movies, logs an extra watch while already on the shelf). When on the shelf it surfaces a small status card with the relevant
 * progress detail. Watch state is read via `useWatchStatus`; writes go through
 * the optimistic mutations in `useWatchActions`. Mirrors the web "Add to shelf"
 * controls so the wording matches across surfaces.
 */
export function MediaTrackingActions(props: MediaTrackingActionsProps) {
	const colors = useThemeColors();
	const { isAuthenticated } = useAuth();
	const { data: settings } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: isAuthenticated,
	});
	const [editingEntry, setEditingEntry] = useState<WatchHistoryEntry | null>(
		null,
	);
	const confirmRemoveWatches = useConfirmRemoveWatches();
	const [datePickerVisible, setDatePickerVisible] = useState(false);
	const [historyVisible, setHistoryVisible] = useState(false);

	const isMovie = props.mediaType === "movie";
	const showId = props.mediaType === "movie" ? "" : props.showId;

	const status = useWatchStatus(
		isMovie
			? { mediaType: "movie", movieId: props.movieId }
			: {
					mediaType: "show",
					showId,
					// Show and season controls have authoritative aggregate progress.
					// Full history is only needed to render/manage an individual episode.
					skipHistory:
						props.mediaType === "show" || props.mediaType === "season",
				},
	);
	const actions = useWatchActions(
		isMovie
			? { mediaType: "movie", movieId: props.movieId }
			: { mediaType: "show", showId },
	);

	const showHistory = status.showWatchHistory ?? [];
	const progress =
		props.mediaType === "show" || props.mediaType === "season"
			? props.progress
			: undefined;
	let isPartial = progress?.state === "partial";

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
			isOnShelf = progress?.state === "complete";
			isPartial = progress?.state === "partial";
			detail =
				progress && progress.state !== "unavailable"
					? `${progress.episodesWatched} of ${progress.episodesTotal} episodes watched`
					: undefined;
			break;
		}
		case "season": {
			isOnShelf = progress?.state === "complete";
			detail = progress
				? `${progress.episodesWatched} of ${progress.episodesTotal} episodes watched`
				: undefined;
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

	// Movies and episodes can hold multiple Watches, so they expose a manageable
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

	// `null` creates an undated Watch; `undefined` means "now".
	const addToShelf = (watchedAt?: string | null) => {
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

	// Movies and episodes are the two types that can hold several Watches, and
	// removing takes all of them, so those two confirm first (the Web detail
	// pages do the same). Shows and seasons are binary, so they just remove.
	const removeFromShelf = () => {
		switch (props.mediaType) {
			case "movie":
				confirmRemoveWatches({
					title: props.title ?? "this movie",
					entryCount: historyEntries.length,
					onConfirm: () => actions.unmarkMovieWatched(),
				});
				break;
			case "show":
				actions.unmarkShowWatched();
				break;
			case "season":
				actions.unmarkSeasonWatched(props.seasonNumber);
				break;
			case "episode": {
				const { seasonNumber, episodeNumber, title } = props;
				const episodeLabel = `S${seasonNumber}E${episodeNumber}`;
				confirmRemoveWatches({
					title: title ? `${title} ${episodeLabel}` : episodeLabel,
					entryCount: historyEntries.length,
					onConfirm: () =>
						actions.unmarkEpisodeWatched(seasonNumber, episodeNumber, "all"),
				});
				break;
			}
		}
	};

	const dismissDatePicker = () => {
		setDatePickerVisible(false);
		if (editingEntry) {
			setEditingEntry(null);
			setHistoryVisible(true);
		}
	};
	const handleEditConfirm = async (watchedAt: string | null) => {
		if (!editingEntry) return;
		try {
			if (isMovie)
				await actions.updateMovieWatchDate(editingEntry.id, watchedAt);
			else await actions.updateEpisodeWatchDate(editingEntry.id, watchedAt);
			dismissDatePicker();
		} catch {
			// Mutation reports the error. Keep the draft open for retry.
		}
	};

	const handleDateConfirm = (iso: string | null) => {
		setDatePickerVisible(false);
		addToShelf(iso);
	};

	if (!isAuthenticated) {
		return (
			<View className="flex-row gap-2 px-4">
				<Link href="/login" asChild>
					<Button label="Sign in to add to shelf" className="flex-1" />
				</Link>
				{props.renderTrailing()}
			</View>
		);
	}

	// Movies can be logged multiple times, so keep "Add with date" available even
	// once on the shelf. The other types are binary, so drop it when on the shelf.
	const showCalendar = !isOnShelf || isMovie;
	const continueTo =
		props.mediaType === "show" || props.mediaType === "season"
			? props.continueTo
			: undefined;
	const shelfVariant = isOnShelf || continueTo ? "secondary" : "primary";

	return (
		<View className="gap-3 px-4">
			{continueTo === "loading" ? (
				<View
					accessibilityLabel="Loading next episode"
					className="h-12 rounded-lg bg-background-subtle"
				/>
			) : continueTo ? (
				<Link href={continueTo.href} asChild>
					<Button
						label={continueTo.label}
						leading={
							<Play
								color={colors.accentForeground}
								size={18}
								strokeWidth={2.5}
							/>
						}
					/>
				</Link>
			) : null}
			{canManageHistory && (isOnShelf || isPartial) ? (
				<Pressable
					onPress={canManageHistory ? () => setHistoryVisible(true) : undefined}
					disabled={!canManageHistory}
					className="flex-row items-center gap-2 rounded-xl border border-border bg-card p-3"
				>
					<View className="rounded-full bg-primary/20 p-1.5">
						{isOnShelf ? (
							<Check color={colors.success} size={16} />
						) : (
							<Plus color={colors.accent} size={16} />
						)}
					</View>
					<View className="flex-1">
						<Text className="font-semibold text-foreground text-sm">
							{isPartial ? "In progress" : "On shelf"}
						</Text>
						{detail ? (
							<Text className="text-muted-foreground text-xs">{detail}</Text>
						) : null}
					</View>
					{canManageHistory ? (
						<ChevronRight color={colors.mutedForeground} size={18} />
					) : null}
				</Pressable>
			) : null}

			<View className="flex-row gap-2">
				<Button
					// The row shares its width with three buttons, so the visible label
					// stays short; the status card above says what it acts on.
					label={
						isOnShelf ? "Remove" : isPartial ? "Mark watched" : "Add to shelf"
					}
					accessibilityLabel={
						isOnShelf
							? "Remove from shelf"
							: isPartial
								? "Mark remaining watched"
								: "Add to shelf"
					}
					loadingLabel="Loading"
					variant={shelfVariant}
					className="flex-1"
					loading={isPending}
					leading={
						isOnShelf ? (
							<X color={colors.destructive} size={18} />
						) : (
							<Plus
								color={
									shelfVariant === "primary"
										? colors.accentForeground
										: colors.foreground
								}
								size={18}
								strokeWidth={2.5}
							/>
						)
					}
					onPress={() => (isOnShelf ? removeFromShelf() : addToShelf())}
				/>
				{props.renderTrailing(
					showCalendar ? () => setDatePickerVisible(true) : undefined,
				)}
			</View>

			<WatchDatePickerModal
				visible={datePickerVisible}
				onDismiss={dismissDatePicker}
				initialWatchedAt={
					editingEntry ? (editingEntry.watchedDate ?? null) : undefined
				}
				timeZone={settings?.timezone}
				onConfirm={editingEntry ? handleEditConfirm : handleDateConfirm}
				isLoading={
					editingEntry
						? !!(actions.updatingMovieWatchId || actions.updatingEpisodeWatchId)
						: isMarkPending
				}
			/>

			{canManageHistory ? (
				<WatchHistorySheet
					visible={historyVisible}
					onDismiss={() => setHistoryVisible(false)}
					title={historySubtitle}
					entries={historyEntries}
					timeZone={settings?.timezone}
					hour12={settings?.timeFormat === "12h"}
					onEdit={(entry) => {
						setHistoryVisible(false);
						setEditingEntry(entry);
						setDatePickerVisible(true);
					}}
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
