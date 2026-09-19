import type { RatingResponseDto } from "@opnshelf/api";
import {
	ratingsControllerClearRatingMutation,
	ratingsControllerGetBatchRatings,
	ratingsControllerGetMediaRatingOptions,
	ratingsControllerGetMediaRatingQueryKey,
	ratingsControllerGetRatingOptions,
	ratingsControllerGetRatingQueryKey,
	ratingsControllerSetRatingMutation,
} from "@opnshelf/api";
import {
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { posthog } from "#/integrations/posthog/provider";

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
		// A Rating is a PDS write, so the round trip runs into seconds. Paint the
		// new value at once and let the refetch confirm it: waiting on the server
		// left the stars showing the old rating, which reads as a dead click.
		onMutate: async (variables) => {
			await queryClient.cancelQueries({ queryKey: ratingKey });
			const previous = queryClient.getQueryData<RatingResponseDto | null>(
				ratingKey,
			);
			queryClient.setQueryData<RatingResponseDto | null>(ratingKey, (old) =>
				old
					? { ...old, rating: variables.body.rating }
					: {
							// No id or rkey until the server answers, so Clear stays
							// disabled for as long as this stand-in is on screen.
							id: "",
							rkey: "",
							rating: variables.body.rating,
							mediaType: resolvedMediaType,
							mediaId,
							seasonNumber,
							episodeNumber,
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
						},
			);
			return { previous };
		},
		onSuccess: (_data, variables) => {
			posthog.capture("rating_saved", {
				media_type: resolvedMediaType,
				rating: variables.body.rating,
				source: "web",
			});
		},
		onError: (error, _variables, context) => {
			queryClient.setQueryData(ratingKey, context?.previous);
			toast.error(
				error instanceof Error ? error.message : "Failed to save rating",
			);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ratingKey });
			queryClient.invalidateQueries({ queryKey: mediaRatingKey });
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
		onMutate: async () => {
			await queryClient.cancelQueries({ queryKey: ratingKey });
			const previous = queryClient.getQueryData<RatingResponseDto | null>(
				ratingKey,
			);
			queryClient.setQueryData<RatingResponseDto | null>(ratingKey, null);
			return { previous };
		},
		onError: (error, _variables, context) => {
			queryClient.setQueryData(ratingKey, context?.previous);
			toast.error(
				error instanceof Error ? error.message : "Failed to clear rating",
			);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ratingKey });
			queryClient.invalidateQueries({ queryKey: mediaRatingKey });
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

/** The backend rejects a batch over this many ids, and rejects duplicates. */
const MAX_BATCH_SIZE = 100;

interface BatchRatingItem {
	id: string | number;
	type: "movie" | "show";
}

export interface BatchRating {
	averageRating?: number;
	ratingCount: number;
}

function batchesFor(items: BatchRatingItem[], mediaType: "movie" | "show") {
	const ids = [
		...new Set(
			items.filter((item) => item.type === mediaType).map((i) => String(i.id)),
		),
	].sort();
	return Array.from(
		{ length: Math.ceil(ids.length / MAX_BATCH_SIZE) },
		(_, index) => ({
			mediaType,
			mediaIds: ids.slice(index * MAX_BATCH_SIZE, (index + 1) * MAX_BATCH_SIZE),
		}),
	);
}

/**
 * Aggregate ratings for a list of posters. The endpoint takes its ids in a POST
 * body, but it is a read, so it belongs in QueryClient like `useShowProgress`:
 * the batch is keyed by its ids, not by the identity of the array a render
 * happened to build. Driving it as a mutation from an effect meant every
 * re-render of a detail page fired another POST, and any of those left in
 * flight when the user navigated away failed as a reported mutation failure.
 */
export function useBatchRatingsQuery(items: BatchRatingItem[]) {
	const batches = [...batchesFor(items, "movie"), ...batchesFor(items, "show")];

	const queries = useQueries({
		queries: batches.map((batch) => ({
			queryKey: ["ratings", "batch", batch.mediaType, batch.mediaIds],
			staleTime: 60_000,
			queryFn: async () => {
				const { data } = await ratingsControllerGetBatchRatings({
					body: { mediaType: batch.mediaType, mediaIds: batch.mediaIds },
					throwOnError: true,
				});
				if (!data) throw new Error("Batch ratings response was empty");
				return data;
			},
		})),
	});

	const ratings = new Map<string, BatchRating>();
	for (const query of queries) {
		for (const item of query.data?.items ?? []) {
			ratings.set(item.mediaId, item);
		}
	}

	return { ratings, isLoading: queries.some((query) => query.isLoading) };
}
