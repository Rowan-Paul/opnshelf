import { type Href, Link } from "expo-router";
import { Check, Plus, Star } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { NoteEditorSheet } from "@/components/detail/NoteEditorSheet";
import { RatingSheet } from "@/components/detail/RatingSheet";
import { AddToListSheet } from "@/components/lists/AddToListSheet";
import { MediaQuickActionsSheet } from "@/components/media/MediaQuickActionsSheet";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { posterUrl } from "@/lib/tmdb";
import { useListMembership } from "@/lib/use-lists";
import { useNote } from "@/lib/use-note";
import { useReview } from "@/lib/use-review";
import { useWatchActions } from "@/lib/use-watch-actions";
import { useWatchStatus } from "@/lib/use-watch-status";

export type MediaCardItem = {
	id: number;
	type: "movie" | "show";
	title: string;
	posterPath?: string | null;
	year?: string;
	rating?: number;
	/**
	 * Optional override for the detail route. Defaults to the movie/show route
	 * derived from `type` + `id`; callers pass this to deep-link episodes shown
	 * with their parent show's poster straight to the episode page.
	 */
	href?: Href;
	/**
	 * Present when this card represents a watched episode (shown with its parent
	 * show's poster). Drives the episode label line and scopes the action layer
	 * to the single episode rather than the whole show. `id`/`type` stay
	 * show-based so the route base and the show-keyed data hooks still resolve.
	 */
	episode?: {
		seasonNumber: number;
		episodeNumber: number;
		showTitle: string;
		episodeTitle?: string;
	};
	/**
	 * Free-form label line replacing the year/rating row (e.g. "Season 2" for
	 * season-scoped list entries). Ignored when `episode` is set.
	 */
	label?: string;
};

/**
 * Poster card for grid/list rendering of movies and shows. Props-driven so
 * search, discover, and future shelf screens can all reuse it. Wraps an
 * Expo Router `Link` to the matching detail route.
 *
 * Pass `actions` to opt into the inline quick-action layer (a corner watched
 * toggle for movies + a long-press quick-actions sheet). It's off by default so
 * the many read-only grid usages are visually and behaviourally unchanged; the
 * action wiring (and its data hooks) only mount when a screen opts in.
 */
export function MediaCard({
	item,
	actions = false,
}: {
	item: MediaCardItem;
	actions?: boolean;
}) {
	if (actions) return <MediaCardWithActions item={item} />;
	return <MediaCardBase item={item} />;
}

const href = (item: MediaCardItem): Href =>
	item.href ??
	(item.type === "movie"
		? (`/movie/${item.id}` as const)
		: (`/show/${item.id}` as const));

/** Read-only poster card: poster + title/year/rating, linking to detail. */
function MediaCardBase({
	item,
	overlay,
	onLongPress,
}: {
	item: MediaCardItem;
	/** Optional corner overlay rendered on top of the poster. */
	overlay?: React.ReactNode;
	onLongPress?: () => void;
}) {
	return (
		<Link href={href(item)} asChild>
			<Pressable
				className="flex-1"
				onLongPress={onLongPress}
				delayLongPress={300}
			>
				<View className="overflow-hidden rounded-lg border border-border bg-card">
					<PosterImage
						url={posterUrl(item.posterPath)}
						className="aspect-2/3 w-full"
					/>
					{overlay}
				</View>
				<Text
					className="mt-2 font-medium text-foreground text-sm"
					numberOfLines={2}
				>
					{item.title}
				</Text>
				{item.episode ? (
					// Episode label: "S1E2 · Show", trimmed to just "S1E2" when the
					// title line already shows the show (i.e. no episode title).
					<Text
						className="mt-0.5 text-muted-foreground text-xs"
						numberOfLines={1}
					>
						{`S${item.episode.seasonNumber}E${item.episode.episodeNumber}`}
						{item.title !== item.episode.showTitle
							? ` · ${item.episode.showTitle}`
							: ""}
					</Text>
				) : item.label ? (
					<Text
						className="mt-0.5 text-muted-foreground text-xs"
						numberOfLines={1}
					>
						{item.label}
					</Text>
				) : (
					<View className="mt-0.5 flex-row items-center gap-2">
						{item.year ? (
							<Text className="text-muted-foreground text-xs">{item.year}</Text>
						) : null}
						{item.rating && item.rating > 0 ? (
							<View className="flex-row items-center gap-0.5">
								<Star color="#f3bc00" fill="#f3bc00" size={11} />
								<Text className="text-muted-foreground text-xs">
									{item.rating.toFixed(1)}
								</Text>
							</View>
						) : null}
					</View>
				)}
			</Pressable>
		</Link>
	);
}

/**
 * Action-enabled card. Mounts the watch/rating/note/list data hooks, overlays a
 * corner watched toggle for movies and episodes, and opens a quick-actions
 * sheet on long press. Split out from the base so opting out keeps the
 * read-only path free of any data hooks. Episode cards (item.episode set) scope
 * every action to the single episode while keeping the show-based id.
 */
function MediaCardWithActions({ item }: { item: MediaCardItem }) {
	const { isAuthenticated } = useAuth();
	const mediaId = String(item.id);
	const ep = item.episode;
	const isMovie = item.type === "movie" && !ep;

	const watchStatus = useWatchStatus(
		isMovie
			? { mediaType: "movie", movieId: mediaId }
			: { mediaType: "show", showId: mediaId },
	);
	const watchActions = useWatchActions(
		isMovie
			? { mediaType: "movie", movieId: mediaId }
			: { mediaType: "show", showId: mediaId },
	);
	// Episodes carry their coordinates so rating/note/list resolve to the episode
	// (mediaType stays "show" + mediaId = showId; the coords narrow it).
	const coords = ep
		? { seasonNumber: ep.seasonNumber, episodeNumber: ep.episodeNumber }
		: {};
	const review = useReview({ mediaType: item.type, mediaId, ...coords });
	const note = useNote({ mediaType: item.type, mediaId, ...coords });
	const listMembership = useListMembership({
		mediaType: item.type,
		mediaId,
		...coords,
	});

	const [quickVisible, setQuickVisible] = useState(false);
	const [ratingVisible, setRatingVisible] = useState(false);
	const [listVisible, setListVisible] = useState(false);
	const [noteVisible, setNoteVisible] = useState(false);

	// Movie / episode: watched. Show: currently tracking (no single "watched").
	const watched = isMovie
		? !!watchStatus.isWatched
		: ep
			? !!watchStatus.isEpisodeWatched?.(ep.seasonNumber, ep.episodeNumber)
			: !!watchStatus.isTracking;
	const isWatchPending = isMovie
		? watchActions.isMarkMoviePending || watchActions.isUnmarkMoviePending
		: ep
			? watchActions.isMarkEpisodePending || watchActions.isUnmarkEpisodePending
			: watchActions.isMarkShowPending || watchActions.isUnmarkShowPending;

	const toggleWatched = () => {
		if (!isAuthenticated) return;
		if (isMovie) {
			if (watched) watchActions.unmarkMovieWatched();
			else watchActions.markMovieWatched();
		} else if (ep) {
			if (watched)
				watchActions.unmarkEpisodeWatched(ep.seasonNumber, ep.episodeNumber);
			else watchActions.markEpisodeWatched(ep.seasonNumber, ep.episodeNumber);
		} else {
			if (watched) watchActions.unmarkShowWatched();
			else watchActions.markShowWatched();
		}
	};

	// Movies/episodes toggle a single watched state; shows toggle "on shelf"
	// (tracking) via markShowWatched — all three handled by toggleWatched above.
	const cornerToggle = isAuthenticated ? (
		<Pressable
			hitSlop={8}
			onPress={(e) => {
				// Keep the tap on the overlay button, never the card's Link.
				e.stopPropagation();
				toggleWatched();
			}}
			disabled={isWatchPending}
			className={
				watched
					? "absolute top-1.5 right-1.5 size-7 items-center justify-center rounded-full bg-primary"
					: "absolute top-1.5 right-1.5 size-7 items-center justify-center rounded-full bg-black/55"
			}
		>
			{watched ? (
				<Check color="#3f2e00" size={16} strokeWidth={3} />
			) : (
				<Plus color="#ffffff" size={16} strokeWidth={2.5} />
			)}
		</Pressable>
	) : null;

	return (
		<>
			<MediaCardBase
				item={item}
				overlay={cornerToggle}
				onLongPress={isAuthenticated ? () => setQuickVisible(true) : undefined}
			/>

			<MediaQuickActionsSheet
				visible={quickVisible}
				onDismiss={() => setQuickVisible(false)}
				title={item.title}
				watched={watched}
				isWatchPending={isWatchPending}
				hasNote={!!note.note?.content}
				onToggleWatched={() => {
					toggleWatched();
					setQuickVisible(false);
				}}
				onRate={() => {
					setQuickVisible(false);
					setRatingVisible(true);
				}}
				onAddToList={() => {
					setQuickVisible(false);
					setListVisible(true);
				}}
				onEditNote={() => {
					setQuickVisible(false);
					setNoteVisible(true);
				}}
			/>

			<RatingSheet
				visible={ratingVisible}
				onDismiss={() => setRatingVisible(false)}
				rating={review.rating}
				onChange={review.setRating}
				onClear={review.clearRating}
				isClearing={review.isClearingRating}
			/>

			<AddToListSheet
				visible={listVisible}
				onDismiss={() => setListVisible(false)}
				memberships={listMembership.memberships}
				isLoading={listMembership.isLoading}
				onToggle={listMembership.toggle}
			/>

			<NoteEditorSheet
				visible={noteVisible}
				onDismiss={() => setNoteVisible(false)}
				initialContent={note.note?.content ?? ""}
				isEditing={!!note.note?.content}
				onSave={(content) => {
					void note.saveNote(content);
					setNoteVisible(false);
				}}
				onDelete={
					note.note?.content
						? () => {
								void note.deleteNote();
								setNoteVisible(false);
							}
						: undefined
				}
				isSaving={note.isSaving}
				isDeleting={note.isDeleting}
			/>
		</>
	);
}
