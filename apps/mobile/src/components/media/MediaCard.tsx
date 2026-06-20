import { Link } from "expo-router";
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

const href = (item: MediaCardItem) =>
	item.type === "movie"
		? (`/movie/${item.id}` as const)
		: (`/show/${item.id}` as const);

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
					numberOfLines={1}
				>
					{item.title}
				</Text>
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
			</Pressable>
		</Link>
	);
}

/**
 * Action-enabled card. Mounts the watch/rating/note/list data hooks, overlays a
 * corner watched toggle for movies, and opens a quick-actions sheet on long
 * press. Split out from the base so opting out keeps the read-only path free of
 * any data hooks. Episodes never reach this component (MediaCard is movie/show
 * only).
 */
function MediaCardWithActions({ item }: { item: MediaCardItem }) {
	const { isAuthenticated } = useAuth();
	const mediaId = String(item.id);
	const isMovie = item.type === "movie";

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
	const review = useReview({ mediaType: item.type, mediaId });
	const note = useNote({ mediaType: item.type, mediaId });
	const listMembership = useListMembership({ mediaType: item.type, mediaId });

	const [quickVisible, setQuickVisible] = useState(false);
	const [ratingVisible, setRatingVisible] = useState(false);
	const [listVisible, setListVisible] = useState(false);
	const [noteVisible, setNoteVisible] = useState(false);

	// Movie: watched. Show: currently tracking (no single "watched" state).
	const watched = isMovie ? !!watchStatus.isWatched : !!watchStatus.isTracking;
	const isWatchPending = isMovie
		? watchActions.isMarkMoviePending || watchActions.isUnmarkMoviePending
		: watchActions.isMarkShowPending || watchActions.isUnmarkShowPending;

	const toggleWatched = () => {
		if (!isAuthenticated) return;
		if (isMovie) {
			if (watched) watchActions.unmarkMovieWatched();
			else watchActions.markMovieWatched();
		} else {
			if (watched) watchActions.unmarkShowWatched();
			else watchActions.markShowWatched();
		}
	};

	const cornerToggle =
		isAuthenticated && isMovie ? (
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
				mediaType={item.type}
				watched={watched}
				isWatchPending={isWatchPending}
				hasNote={!!note.note}
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
				isEditing={!!note.note}
				onSave={(content) => {
					void note.saveNote(content);
					setNoteVisible(false);
				}}
				onDelete={
					note.note
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
