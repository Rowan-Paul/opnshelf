import { Check, MoreHorizontal, Plus } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { NoteEditorSheet } from "@/components/detail/NoteEditorSheet";
import { RatingSheet } from "@/components/detail/RatingSheet";
import { AddToListSheet } from "@/components/lists/AddToListSheet";
import { MediaQuickActionsSheet } from "@/components/media/MediaQuickActionsSheet";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useListMembership } from "@/lib/use-lists";
import { useNote } from "@/lib/use-note";
import { useReview } from "@/lib/use-review";
import { useWatchActions } from "@/lib/use-watch-actions";
import { useWatchStatus } from "@/lib/use-watch-status";

/**
 * Inline action layer for a feed card: a one-tap "Add to shelf" toggle plus a
 * ⋯ button that opens the shared quick-actions sheet (rate / add-to-list /
 * note). Self-contained — it mounts the same watch/rating/note/list hooks and
 * sheets that `MediaCard`'s action layer uses, so the activity feed gets the
 * full action set without duplicating the wiring. Renders nothing for signed-out
 * users. Episode coordinates scope every action to the single episode while the
 * id stays show-based (so the show-keyed hooks resolve).
 */
export function MediaActionBar({
	type,
	id,
	title,
	episode: ep,
}: {
	type: "movie" | "show";
	id: string;
	title: string;
	episode?: { seasonNumber: number; episodeNumber: number };
}) {
	const { isAuthenticated } = useAuth();
	const isMovie = type === "movie" && !ep;

	const watchStatus = useWatchStatus(
		isMovie
			? { mediaType: "movie", movieId: id }
			: { mediaType: "show", showId: id },
	);
	const watchActions = useWatchActions(
		isMovie
			? { mediaType: "movie", movieId: id }
			: { mediaType: "show", showId: id },
	);
	const coords = ep
		? { seasonNumber: ep.seasonNumber, episodeNumber: ep.episodeNumber }
		: {};
	const review = useReview({ mediaType: type, mediaId: id, ...coords });
	const note = useNote({ mediaType: type, mediaId: id, ...coords });
	const listMembership = useListMembership({
		mediaType: type,
		mediaId: id,
		...coords,
	});

	const [quickVisible, setQuickVisible] = useState(false);
	const [ratingVisible, setRatingVisible] = useState(false);
	const [listVisible, setListVisible] = useState(false);
	const [noteVisible, setNoteVisible] = useState(false);

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

	if (!isAuthenticated) return null;

	return (
		<>
			<View className="mt-1 flex-row items-center gap-2">
				<Pressable
					onPress={(e) => {
						e.stopPropagation();
						toggleWatched();
					}}
					disabled={isWatchPending}
					className={`flex-row items-center gap-1.5 rounded-lg border px-3 py-1.5 ${
						watched
							? "border-border bg-background-subtle"
							: "border-primary bg-primary"
					}`}
					style={{ opacity: isWatchPending ? 0.6 : 1 }}
				>
					{isWatchPending ? (
						<ActivityIndicator size="small" color="#94a3b8" />
					) : watched ? (
						<Check color="#94a3b8" size={15} strokeWidth={3} />
					) : (
						<Plus color="#3f2e00" size={15} strokeWidth={2.5} />
					)}
					<Text
						className={`font-semibold text-xs ${
							watched ? "text-muted-foreground" : "text-primary-foreground"
						}`}
					>
						{watched ? "On shelf" : "Add to shelf"}
					</Text>
				</Pressable>

				<Pressable
					hitSlop={8}
					onPress={(e) => {
						e.stopPropagation();
						setQuickVisible(true);
					}}
					className="size-8 items-center justify-center rounded-lg border border-border"
				>
					<MoreHorizontal color="#94a3b8" size={18} />
				</Pressable>
			</View>

			<MediaQuickActionsSheet
				visible={quickVisible}
				onDismiss={() => setQuickVisible(false)}
				title={title}
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
