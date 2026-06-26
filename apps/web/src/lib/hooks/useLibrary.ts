import {
	type LibraryOwnershipDto,
	libraryControllerAddToLibraryMutation,
	libraryControllerGetLibraryForItemOptions,
	libraryControllerGetLibraryForItemQueryKey,
	libraryControllerGetMyLibraryQueryKey,
	libraryControllerGetUserLibraryQueryKey,
	libraryControllerRemoveFromLibraryMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "#/lib/auth-context";

export type LibraryFormat = LibraryOwnershipDto["format"];

export const LIBRARY_FORMATS: { value: LibraryFormat; label: string }[] = [
	{ value: "bluray4k", label: "Blu-ray 4K" },
	{ value: "bluray", label: "Blu-ray" },
	{ value: "dvd", label: "DVD" },
	{ value: "digital", label: "Digital" },
];

export const FORMAT_LABELS: Record<LibraryFormat, string> = {
	bluray4k: "Blu-ray 4K",
	bluray: "Blu-ray",
	dvd: "DVD",
	digital: "Digital",
};

interface UseLibraryOptions {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
	enabled?: boolean;
}

function resolveMediaType({
	mediaType,
	seasonNumber,
	episodeNumber,
}: UseLibraryOptions): "movie" | "show" | "season" | "episode" {
	if (episodeNumber != null) return "episode";
	if (seasonNumber != null) return "season";
	return mediaType;
}

/** The formats the authenticated user owns this item in. */
export function useLibraryForItem(opts: UseLibraryOptions) {
	const { isAuthenticated } = useAuth();
	const resolvedMediaType = resolveMediaType(opts);

	return useQuery({
		...libraryControllerGetLibraryForItemOptions({
			path: { mediaType: resolvedMediaType, mediaId: opts.mediaId },
			query: {
				seasonNumber: opts.seasonNumber,
				episodeNumber: opts.episodeNumber,
			},
		}),
		enabled: isAuthenticated && (opts.enabled ?? true),
	});
}

/** Add/remove the item from the user's Library, by format. */
export function useLibraryActions(opts: UseLibraryOptions) {
	const { isAuthenticated, user } = useAuth();
	const queryClient = useQueryClient();
	const resolvedMediaType = resolveMediaType(opts);

	const forItemKey = libraryControllerGetLibraryForItemQueryKey({
		path: { mediaType: resolvedMediaType, mediaId: opts.mediaId },
		query: {
			seasonNumber: opts.seasonNumber,
			episodeNumber: opts.episodeNumber,
		},
	});

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: forItemKey });
		queryClient.invalidateQueries({
			queryKey: libraryControllerGetMyLibraryQueryKey(),
		});
		if (user?.did) {
			queryClient.invalidateQueries({
				queryKey: libraryControllerGetUserLibraryQueryKey({
					path: { userDid: user.did },
				}),
			});
		}
	};

	const addMutation = useMutation({
		mutationKey: ["library", "add", resolvedMediaType, opts.mediaId],
		...libraryControllerAddToLibraryMutation(),
		onSuccess: () => toast.success("Added to library"),
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Failed to add to library",
			),
		onSettled: invalidate,
	});

	const removeMutation = useMutation({
		mutationKey: ["library", "remove", resolvedMediaType, opts.mediaId],
		...libraryControllerRemoveFromLibraryMutation(),
		onSuccess: () => toast.success("Removed from library"),
		onError: (error) =>
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to remove from library",
			),
		onSettled: invalidate,
	});

	const addFormat = (format: LibraryFormat, boxSet?: string) => {
		if (!isAuthenticated) return;
		addMutation.mutate({
			body: {
				mediaType: resolvedMediaType,
				mediaId: opts.mediaId,
				format,
				seasonNumber: opts.seasonNumber,
				episodeNumber: opts.episodeNumber,
				boxSet: boxSet?.trim() || undefined,
			},
		});
	};

	const removeFormat = (format: LibraryFormat) => {
		if (!isAuthenticated) return;
		removeMutation.mutate({
			path: { mediaType: resolvedMediaType, mediaId: opts.mediaId, format },
			query: {
				seasonNumber: opts.seasonNumber,
				episodeNumber: opts.episodeNumber,
			},
		});
	};

	return {
		addFormat,
		removeFormat,
		isPending: addMutation.isPending || removeMutation.isPending,
	};
}
