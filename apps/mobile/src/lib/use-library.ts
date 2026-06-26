import {
	type LibraryOwnershipDto,
	libraryControllerAddToLibraryMutation,
	libraryControllerGetLibraryForItemOptions,
	libraryControllerGetLibraryForItemQueryKey,
	libraryControllerGetMyLibraryQueryKey,
	libraryControllerGetUserLibraryOptions,
	libraryControllerGetUserLibraryQueryKey,
	libraryControllerRemoveFromLibraryMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";

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

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}

interface LibraryTarget {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

function resolveMediaType(target: LibraryTarget) {
	if (target.episodeNumber != null) return "episode" as const;
	if (target.seasonNumber != null) return "season" as const;
	return target.mediaType;
}

/** A user's full owned library (newest first). Public — works for any DID. */
export function useUserLibrary(userDid: string) {
	return useQuery({
		...libraryControllerGetUserLibraryOptions({ path: { userDid } }),
		enabled: !!userDid,
	});
}

/**
 * The formats the authenticated user owns an item in, plus add/remove toggles.
 * Mirrors `useListMembership` but the axis is Format, not list slug.
 */
export function useLibraryOwnership(target: LibraryTarget) {
	const { isAuthenticated, user } = useAuth();
	const queryClient = useQueryClient();
	const toast = useToast();
	const resolvedMediaType = resolveMediaType(target);

	const forItemKey = libraryControllerGetLibraryForItemQueryKey({
		path: { mediaType: resolvedMediaType, mediaId: target.mediaId },
		query: {
			seasonNumber: target.seasonNumber,
			episodeNumber: target.episodeNumber,
		},
	});

	const ownedQuery = useQuery({
		...libraryControllerGetLibraryForItemOptions({
			path: { mediaType: resolvedMediaType, mediaId: target.mediaId },
			query: {
				seasonNumber: target.seasonNumber,
				episodeNumber: target.episodeNumber,
			},
		}),
		enabled: isAuthenticated && !!target.mediaId,
	});

	const settle = () => {
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
		mutationKey: ["library", "add", resolvedMediaType, target.mediaId],
		...libraryControllerAddToLibraryMutation(),
		onError: (error) =>
			toast.error(errorMessage(error, "Failed to add to library")),
		onSettled: settle,
	});

	const removeMutation = useMutation({
		mutationKey: ["library", "remove", resolvedMediaType, target.mediaId],
		...libraryControllerRemoveFromLibraryMutation(),
		onError: (error) =>
			toast.error(errorMessage(error, "Failed to remove from library")),
		onSettled: settle,
	});

	const owned = ownedQuery.data ?? [];

	const toggle = (format: LibraryFormat, boxSet?: string) => {
		if (!isAuthenticated) return;
		void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
		const isOwned = owned.some((item) => item.format === format);
		if (isOwned) {
			removeMutation.mutate({
				path: {
					mediaType: resolvedMediaType,
					mediaId: target.mediaId,
					format,
				},
				query: {
					seasonNumber: target.seasonNumber,
					episodeNumber: target.episodeNumber,
				},
			});
		} else {
			addMutation.mutate({
				body: {
					mediaType: resolvedMediaType,
					mediaId: target.mediaId,
					format,
					seasonNumber: target.seasonNumber,
					episodeNumber: target.episodeNumber,
					boxSet: boxSet?.trim() || undefined,
				},
			});
		}
	};

	return {
		owned,
		ownedFormats: new Set(owned.map((item) => item.format)),
		isLoading: ownedQuery.isLoading,
		toggle,
		isPending: addMutation.isPending || removeMutation.isPending,
	};
}
