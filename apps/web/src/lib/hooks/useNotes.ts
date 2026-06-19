import {
	notesControllerDeleteNoteMutation,
	notesControllerGetNoteOptions,
	notesControllerGetNoteQueryKey,
	notesControllerUpsertNoteMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface UseNoteOptions {
	userDid: string;
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

function resolveMediaType(
	mediaType: "movie" | "show",
	seasonNumber?: number,
	episodeNumber?: number,
) {
	return episodeNumber != null
		? "episode"
		: seasonNumber != null
			? "season"
			: mediaType;
}

export function useNote({
	userDid,
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: UseNoteOptions) {
	const resolvedMediaType = resolveMediaType(
		mediaType,
		seasonNumber,
		episodeNumber,
	);

	return useQuery({
		...notesControllerGetNoteOptions({
			path: { userDid },
			query: {
				mediaType: resolvedMediaType,
				mediaId,
				seasonNumber,
				episodeNumber,
			},
		}),
		enabled: !!userDid,
	});
}

interface UseUpsertNoteOptions {
	userDid: string;
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

export function useUpsertNote({
	userDid,
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: UseUpsertNoteOptions) {
	const queryClient = useQueryClient();
	const resolvedMediaType = resolveMediaType(
		mediaType,
		seasonNumber,
		episodeNumber,
	);

	const noteKey = notesControllerGetNoteQueryKey({
		path: { userDid },
		query: {
			mediaType: resolvedMediaType,
			mediaId,
			seasonNumber,
			episodeNumber,
		},
	});

	return useMutation({
		mutationKey: ["notes", "upsert", resolvedMediaType, mediaId],
		...notesControllerUpsertNoteMutation(),
		onSuccess: () => {
			toast.success("Note saved");
			queryClient.invalidateQueries({ queryKey: noteKey });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to save note",
			);
		},
	});
}

interface UseDeleteNoteOptions {
	userDid: string;
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

export function useDeleteNote({
	userDid,
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: UseDeleteNoteOptions) {
	const queryClient = useQueryClient();
	const resolvedMediaType = resolveMediaType(
		mediaType,
		seasonNumber,
		episodeNumber,
	);

	const noteKey = notesControllerGetNoteQueryKey({
		path: { userDid },
		query: {
			mediaType: resolvedMediaType,
			mediaId,
			seasonNumber,
			episodeNumber,
		},
	});

	return useMutation({
		mutationKey: ["notes", "delete", resolvedMediaType, mediaId],
		...notesControllerDeleteNoteMutation(),
		onSuccess: () => {
			toast.success("Note deleted");
			queryClient.invalidateQueries({ queryKey: noteKey });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete note",
			);
		},
	});
}
