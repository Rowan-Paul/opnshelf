import {
	notesControllerDeleteNoteMutation,
	notesControllerGetNoteOptions,
	notesControllerGetNoteQueryKey,
	notesControllerUpsertNoteMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
		...notesControllerUpsertNoteMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: noteKey });
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
		...notesControllerDeleteNoteMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: noteKey });
		},
	});
}
