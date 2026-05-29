import {
	reviewsControllerCreateReviewMutation,
	reviewsControllerDeleteReviewMutation,
	reviewsControllerGetMediaReviewsOptions,
	reviewsControllerGetMediaReviewsQueryKey,
	reviewsControllerGetReviewLikesOptions,
	reviewsControllerGetReviewLikesQueryKey,
	reviewsControllerGetUserReviewsOptions,
	reviewsControllerGetUserReviewsQueryKey,
	reviewsControllerLikeReviewMutation,
	reviewsControllerUnlikeReviewMutation,
	reviewsControllerUpdateReviewMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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

interface UseReviewMutationOptions {
	userDid: string;
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

/** Invalidate every query that lists this media item's or this user's reviews. */
function useReviewInvalidation({
	userDid,
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: UseReviewMutationOptions) {
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

	const userReviewsKey = reviewsControllerGetUserReviewsQueryKey({
		path: { userDid },
		query: { limit: 20 },
	});

	return () => {
		queryClient.invalidateQueries({ queryKey: mediaReviewsKey });
		queryClient.invalidateQueries({ queryKey: userReviewsKey });
	};
}

export function useCreateReview(options: UseReviewMutationOptions) {
	const invalidate = useReviewInvalidation(options);
	const resolvedMediaType = resolveMediaType(
		options.mediaType,
		options.seasonNumber,
		options.episodeNumber,
	);

	return useMutation({
		mutationKey: [
			"reviews",
			resolvedMediaType,
			options.mediaId,
			options.seasonNumber ?? 0,
			options.episodeNumber ?? 0,
			"create",
		],
		...reviewsControllerCreateReviewMutation(),
		onSuccess: () => {
			toast.success("Review published");
			invalidate();
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to publish review",
			);
		},
	});
}

export function useUpdateReview(options: UseReviewMutationOptions) {
	const invalidate = useReviewInvalidation(options);
	const resolvedMediaType = resolveMediaType(
		options.mediaType,
		options.seasonNumber,
		options.episodeNumber,
	);

	return useMutation({
		mutationKey: [
			"reviews",
			resolvedMediaType,
			options.mediaId,
			options.seasonNumber ?? 0,
			options.episodeNumber ?? 0,
			"update",
		],
		...reviewsControllerUpdateReviewMutation(),
		onSuccess: () => {
			toast.success("Review updated");
			invalidate();
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to update review",
			);
		},
	});
}

export function useDeleteReview(options: UseReviewMutationOptions) {
	const invalidate = useReviewInvalidation(options);
	const resolvedMediaType = resolveMediaType(
		options.mediaType,
		options.seasonNumber,
		options.episodeNumber,
	);

	return useMutation({
		mutationKey: [
			"reviews",
			resolvedMediaType,
			options.mediaId,
			options.seasonNumber ?? 0,
			options.episodeNumber ?? 0,
			"delete",
		],
		...reviewsControllerDeleteReviewMutation(),
		onSuccess: () => {
			toast.success("Review deleted");
			invalidate();
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete review",
			);
		},
	});
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
		mutationKey: ["reviews", reviewId, "like"],
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
		mutationKey: ["reviews", reviewId, "unlike"],
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
		mutationKey: [
			"reviews",
			resolvedMediaType,
			mediaId,
			seasonNumber ?? 0,
			episodeNumber ?? 0,
			"toggle-like",
		],
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
		mutationKey: [
			"reviews",
			resolvedMediaType,
			mediaId,
			seasonNumber ?? 0,
			episodeNumber ?? 0,
			"toggle-unlike",
		],
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
