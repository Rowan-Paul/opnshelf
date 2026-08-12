import {
	notesControllerDeleteNoteMutation,
	notesControllerGetNoteOptions,
	notesControllerGetNoteQueryKey,
	notesControllerUpsertNoteMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";

interface NoteTarget {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
	/**
	 * Defaults to true. A grid of posters mounts one of these per card, which is
	 * enough requests at once to trip the API's rate limit, so a card passes
	 * false until the user actually opens its quick actions.
	 */
	enabled?: boolean;
}

function resolveMediaType(
	mediaType: "movie" | "show",
	seasonNumber?: number,
	episodeNumber?: number,
): "movie" | "show" | "season" | "episode" {
	if (episodeNumber != null) return "episode";
	if (seasonNumber != null) return "season";
	return mediaType;
}

/**
 * The current user's single freeform note for a media item, plus upsert/delete
 * operations. Mirrors the web `useNote`/`useUpsertNote`/`useDeleteNote` hooks
 * over the shared `@opnshelf/api` note procedures — a note is one-per-item
 * (upsert), distinct from the zero-or-many long-form reviews in `use-review`.
 */
export function useNote(target: NoteTarget) {
	const { user, isAuthenticated } = useAuth();
	const userDid = user?.did ?? "";
	const queryClient = useQueryClient();
	const toast = useToast();

	const resolvedMediaType = resolveMediaType(
		target.mediaType,
		target.seasonNumber,
		target.episodeNumber,
	);

	const query = {
		mediaType: resolvedMediaType,
		mediaId: target.mediaId,
		seasonNumber: target.seasonNumber,
		episodeNumber: target.episodeNumber,
	};

	const noteKey = notesControllerGetNoteQueryKey({ path: { userDid }, query });

	const noteQuery = useQuery({
		...notesControllerGetNoteOptions({ path: { userDid }, query }),
		enabled:
			isAuthenticated &&
			!!userDid &&
			!!target.mediaId &&
			target.enabled !== false,
	});

	const note = noteQuery.data ?? null;

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: noteKey });
	};

	const upsertMutation = useMutation({
		mutationKey: ["notes", "upsert", resolvedMediaType, target.mediaId],
		...notesControllerUpsertNoteMutation(),
	});

	const deleteMutation = useMutation({
		mutationKey: ["notes", "delete", resolvedMediaType, target.mediaId],
		...notesControllerDeleteNoteMutation(),
	});

	/** Create or update the note for this media item. */
	const saveNote = async (content: string) => {
		if (!isAuthenticated) return;
		const trimmed = content.trim();
		if (!trimmed) return;
		try {
			await upsertMutation.mutateAsync({
				body: {
					mediaType: resolvedMediaType,
					mediaId: target.mediaId,
					seasonNumber: target.seasonNumber,
					episodeNumber: target.episodeNumber,
					content: trimmed,
				},
			});
			void Haptics.notificationAsync(
				Haptics.NotificationFeedbackType.Success,
			).catch(() => {});
			toast.success("Note saved");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to save");
		} finally {
			invalidate();
		}
	};

	/** Delete the note for this media item. */
	const deleteNote = async () => {
		if (!isAuthenticated || !note?.id) return;
		try {
			await deleteMutation.mutateAsync({ path: { noteId: note.id } });
			void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
				() => {},
			);
			toast.success("Note deleted");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to delete");
		} finally {
			invalidate();
		}
	};

	return {
		note,
		isAuthenticated,
		isLoading: noteQuery.isLoading,
		saveNote,
		deleteNote,
		isSaving: upsertMutation.isPending,
		isDeleting: deleteMutation.isPending,
	};
}
