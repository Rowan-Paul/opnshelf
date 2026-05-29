import {
	ratingsControllerClearRatingMutation,
	ratingsControllerGetBatchRatingsMutation,
	ratingsControllerGetMediaRatingOptions,
	ratingsControllerGetMediaRatingQueryKey,
	ratingsControllerGetRatingOptions,
	ratingsControllerGetRatingQueryKey,
	ratingsControllerSetRatingMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface UseRatingOptions {
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

export function useRating({
	userDid,
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: UseRatingOptions) {
	const resolvedMediaType = resolveMediaType(
		mediaType,
		seasonNumber,
		episodeNumber,
	);

	return useQuery({
		...ratingsControllerGetRatingOptions({
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

interface UseSetRatingOptions {
	userDid: string;
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

export function useSetRating({
	userDid,
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: UseSetRatingOptions) {
	const queryClient = useQueryClient();
	const resolvedMediaType = resolveMediaType(
		mediaType,
		seasonNumber,
		episodeNumber,
	);

	const ratingKey = ratingsControllerGetRatingQueryKey({
		path: { userDid },
		query: {
			mediaType: resolvedMediaType,
			mediaId,
			seasonNumber,
			episodeNumber,
		},
	});

	const mediaRatingKey = ratingsControllerGetMediaRatingQueryKey({
		query: {
			mediaType: resolvedMediaType,
			mediaId,
			seasonNumber,
			episodeNumber,
		},
	});

	return useMutation({
		mutationKey: [
			"ratings",
			resolvedMediaType,
			mediaId,
			seasonNumber ?? 0,
			episodeNumber ?? 0,
			"set",
		],
		...ratingsControllerSetRatingMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ratingKey });
			queryClient.invalidateQueries({ queryKey: mediaRatingKey });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to save rating",
			);
		},
	});
}

interface UseClearRatingOptions {
	userDid: string;
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

export function useClearRating({
	userDid,
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: UseClearRatingOptions) {
	const queryClient = useQueryClient();
	const resolvedMediaType = resolveMediaType(
		mediaType,
		seasonNumber,
		episodeNumber,
	);

	const ratingKey = ratingsControllerGetRatingQueryKey({
		path: { userDid },
		query: {
			mediaType: resolvedMediaType,
			mediaId,
			seasonNumber,
			episodeNumber,
		},
	});

	const mediaRatingKey = ratingsControllerGetMediaRatingQueryKey({
		query: {
			mediaType: resolvedMediaType,
			mediaId,
			seasonNumber,
			episodeNumber,
		},
	});

	return useMutation({
		mutationKey: [
			"ratings",
			resolvedMediaType,
			mediaId,
			seasonNumber ?? 0,
			episodeNumber ?? 0,
			"clear",
		],
		...ratingsControllerClearRatingMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ratingKey });
			queryClient.invalidateQueries({ queryKey: mediaRatingKey });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to clear rating",
			);
		},
	});
}

interface UseMediaRatingOptions {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

export function useMediaRating({
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: UseMediaRatingOptions) {
	const resolvedMediaType = resolveMediaType(
		mediaType,
		seasonNumber,
		episodeNumber,
	);

	return useQuery({
		...ratingsControllerGetMediaRatingOptions({
			query: {
				mediaType: resolvedMediaType,
				mediaId,
				seasonNumber,
				episodeNumber,
			},
		}),
		enabled: !!mediaId,
	});
}

export function useBatchRatings() {
	return useMutation({
		mutationKey: ["ratings", "batch"],
		...ratingsControllerGetBatchRatingsMutation(),
	});
}

interface BatchRatingItem {
	id: string | number;
	type: "movie" | "show";
}

export function useBatchRatingsQuery(items: BatchRatingItem[]) {
	const mutation = useBatchRatings();
	const [ratings, setRatings] = useState<
		Map<string, { averageRating?: number; ratingCount: number }>
	>(new Map());

	useEffect(() => {
		const movieIds = items
			.filter((i) => i.type === "movie")
			.map((i) => String(i.id));
		const showIds = items
			.filter((i) => i.type === "show")
			.map((i) => String(i.id));

		const promises: Promise<void>[] = [];

		if (movieIds.length > 0) {
			promises.push(
				mutation
					.mutateAsync({ body: { mediaType: "movie", mediaIds: movieIds } })
					.then((res) => {
						setRatings((prev) => {
							const next = new Map(prev);
							for (const item of res.items) {
								next.set(item.mediaId, item);
							}
							return next;
						});
					}),
			);
		}

		if (showIds.length > 0) {
			promises.push(
				mutation
					.mutateAsync({ body: { mediaType: "show", mediaIds: showIds } })
					.then((res) => {
						setRatings((prev) => {
							const next = new Map(prev);
							for (const item of res.items) {
								next.set(item.mediaId, item);
							}
							return next;
						});
					}),
			);
		}

		if (promises.length > 0) {
			Promise.all(promises).catch(() => {
				// silently ignore batch rating errors
			});
		}
	}, [items, mutation.mutateAsync]);

	return { ratings, isLoading: mutation.isPending };
}
