import {
	reviewsControllerDeleteReviewMutation,
	reviewsControllerGetBatchRatingsMutation,
	reviewsControllerGetMediaReviewsOptions,
	reviewsControllerGetMediaReviewsQueryKey,
	reviewsControllerGetReviewLikesOptions,
	reviewsControllerGetReviewLikesQueryKey,
	reviewsControllerGetReviewOptions,
	reviewsControllerGetReviewQueryKey,
	reviewsControllerGetUserReviewsOptions,
	reviewsControllerLikeReviewMutation,
	reviewsControllerUnlikeReviewMutation,
	reviewsControllerUpsertReviewMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface UseReviewOptions {
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

export function useReview({
	userDid,
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: UseReviewOptions) {
	const resolvedMediaType = resolveMediaType(
		mediaType,
		seasonNumber,
		episodeNumber,
	);

	return useQuery({
		...reviewsControllerGetReviewOptions({
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

interface UseUpsertReviewOptions {
	userDid: string;
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

export function useUpsertReview({
	userDid,
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: UseUpsertReviewOptions) {
	const queryClient = useQueryClient();
	const resolvedMediaType = resolveMediaType(
		mediaType,
		seasonNumber,
		episodeNumber,
	);

	const reviewKey = reviewsControllerGetReviewQueryKey({
		path: { userDid },
		query: {
			mediaType: resolvedMediaType,
			mediaId,
			seasonNumber,
			episodeNumber,
		},
	});

	const mediaReviewsKey = reviewsControllerGetMediaReviewsQueryKey({
		query: {
			mediaType: resolvedMediaType,
			mediaId,
			seasonNumber,
			episodeNumber,
		},
	});

	return useMutation({
		...reviewsControllerUpsertReviewMutation(),
		onSuccess: () => {
			toast.success("Review saved");
			queryClient.invalidateQueries({ queryKey: reviewKey });
			queryClient.invalidateQueries({ queryKey: mediaReviewsKey });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to save review",
			);
		},
	});
}

interface UseDeleteReviewOptions {
	userDid: string;
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

export function useDeleteReview({
	userDid,
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: UseDeleteReviewOptions) {
	const queryClient = useQueryClient();
	const resolvedMediaType = resolveMediaType(
		mediaType,
		seasonNumber,
		episodeNumber,
	);

	const reviewKey = reviewsControllerGetReviewQueryKey({
		path: { userDid },
		query: {
			mediaType: resolvedMediaType,
			mediaId,
			seasonNumber,
			episodeNumber,
		},
	});

	const mediaReviewsKey = reviewsControllerGetMediaReviewsQueryKey({
		query: {
			mediaType: resolvedMediaType,
			mediaId,
			seasonNumber,
			episodeNumber,
		},
	});

	return useMutation({
		...reviewsControllerDeleteReviewMutation(),
		onSuccess: () => {
			toast.success("Review deleted");
			queryClient.invalidateQueries({ queryKey: reviewKey });
			queryClient.invalidateQueries({ queryKey: mediaReviewsKey });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete review",
			);
		},
	});
}

interface UseMediaReviewsOptions {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

export function useMediaReviews({
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: UseMediaReviewsOptions) {
	const resolvedMediaType = resolveMediaType(
		mediaType,
		seasonNumber,
		episodeNumber,
	);

	return useQuery({
		...reviewsControllerGetMediaReviewsOptions({
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

interface UseUserReviewsOptions {
	userDid: string;
	limit?: number;
	cursor?: string;
}

export function useUserReviews({
	userDid,
	limit,
	cursor,
}: UseUserReviewsOptions) {
	return useQuery({
		...reviewsControllerGetUserReviewsOptions({
			path: { userDid },
			query: { limit, cursor },
		}),
		enabled: !!userDid,
	});
}

export function useBatchRatings() {
	return useMutation({
		...reviewsControllerGetBatchRatingsMutation(),
	});
}

interface BatchRatingItem {
	id: string | number;
	type: "movie" | "show";
}

export function useBatchRatingsQuery(items: BatchRatingItem[]) {
	const mutation = useBatchRatings();
	const [ratings, setRatings] = useState<
		Map<string, { averageRating?: number; reviewCount: number }>
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

interface UseReviewLikesOptions {
	reviewId: string;
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

export function useReviewLikes({
	reviewId,
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: UseReviewLikesOptions) {
	const queryClient = useQueryClient();
	const resolvedMediaType = resolveMediaType(
		mediaType,
		seasonNumber,
		episodeNumber,
	);

	const likesQuery = useQuery({
		...reviewsControllerGetReviewLikesOptions({
			path: { reviewId },
		}),
		enabled: !!reviewId,
	});

	const mediaReviewsKey = reviewsControllerGetMediaReviewsQueryKey({
		query: {
			mediaType: resolvedMediaType,
			mediaId,
			seasonNumber,
			episodeNumber,
		},
	});

	const likeMutation = useMutation({
		...reviewsControllerLikeReviewMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: reviewsControllerGetReviewLikesQueryKey({
					path: { reviewId },
				}),
			});
			queryClient.invalidateQueries({ queryKey: mediaReviewsKey });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to like review",
			);
		},
	});

	const unlikeMutation = useMutation({
		...reviewsControllerUnlikeReviewMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: reviewsControllerGetReviewLikesQueryKey({
					path: { reviewId },
				}),
			});
			queryClient.invalidateQueries({ queryKey: mediaReviewsKey });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to unlike review",
			);
		},
	});

	return {
		...likesQuery,
		likeReview: () => likeMutation.mutate({ path: { reviewId } }),
		unlikeReview: () => unlikeMutation.mutate({ path: { reviewId } }),
		isLikePending: likeMutation.isPending,
		isUnlikePending: unlikeMutation.isPending,
	};
}

interface UseToggleReviewLikeOptions {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

export function useToggleReviewLike({
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: UseToggleReviewLikeOptions) {
	const queryClient = useQueryClient();
	const resolvedMediaType = resolveMediaType(
		mediaType,
		seasonNumber,
		episodeNumber,
	);

	const mediaReviewsKey = reviewsControllerGetMediaReviewsQueryKey({
		query: {
			mediaType: resolvedMediaType,
			mediaId,
			seasonNumber,
			episodeNumber,
		},
	});

	const likeMutation = useMutation({
		...reviewsControllerLikeReviewMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: mediaReviewsKey });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to like review",
			);
		},
	});

	const unlikeMutation = useMutation({
		...reviewsControllerUnlikeReviewMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: mediaReviewsKey });
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to unlike review",
			);
		},
	});

	return {
		likeReview: (reviewId: string) =>
			likeMutation.mutate({ path: { reviewId } }),
		unlikeReview: (reviewId: string) =>
			unlikeMutation.mutate({ path: { reviewId } }),
		isLikePending: likeMutation.isPending,
		isUnlikePending: unlikeMutation.isPending,
	};
}
