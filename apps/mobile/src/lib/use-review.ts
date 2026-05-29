import {
	type ReviewResponseDto,
	reviewsControllerDeleteReviewMutation,
	reviewsControllerGetMediaReviewsQueryKey,
	reviewsControllerGetReviewOptions,
	reviewsControllerGetReviewQueryKey,
	reviewsControllerUpsertReviewMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";

interface ReviewTarget {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

/**
 * Rating + review live on a single entity: a review carries a required
 * `rating` (1-10) and optional `content`. There is no separate rating endpoint,
 * so upsert handles both "just a rating" and "rating + text".
 */
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
 * The current user's own review for a media item, plus upsert + delete mutations
 * with optimistic cache updates and rollback. The rating is part of the review
 * (no separate rating entity), so `useReview().upsert({ rating, content })`
 * covers both rate-only and rate-with-text.
 */
export function useReview(target: ReviewTarget) {
	const { user, isAuthenticated } = useAuth();
	const userDid = user?.did ?? "";
	const queryClient = useQueryClient();
	const toast = useToast();

	const resolvedMediaType = resolveMediaType(
		target.mediaType,
		target.seasonNumber,
		target.episodeNumber,
	);

	const reviewQueryArgs = {
		path: { userDid },
		query: {
			mediaType: resolvedMediaType,
			mediaId: target.mediaId,
			seasonNumber: target.seasonNumber,
			episodeNumber: target.episodeNumber,
		},
	} as const;

	const reviewKey = reviewsControllerGetReviewQueryKey(reviewQueryArgs);
	const mediaReviewsKey = reviewsControllerGetMediaReviewsQueryKey({
		query: {
			mediaType: resolvedMediaType,
			mediaId: target.mediaId,
			seasonNumber: target.seasonNumber,
			episodeNumber: target.episodeNumber,
		},
	});

	const reviewQuery = useQuery({
		...reviewsControllerGetReviewOptions(reviewQueryArgs),
		enabled: isAuthenticated && !!userDid && !!target.mediaId,
	});

	const review = reviewQuery.data ?? null;

	const upsert = useMutation({
		mutationKey: ["review", "upsert", resolvedMediaType, target.mediaId],
		...reviewsControllerUpsertReviewMutation(),
		onMutate: async (variables) => {
			await queryClient.cancelQueries({ queryKey: reviewKey });
			const prevReview = queryClient.getQueryData<ReviewResponseDto>(reviewKey);
			const now = new Date().toISOString();
			queryClient.setQueryData<ReviewResponseDto>(reviewKey, (old) => ({
				id: old?.id ?? `optimistic-${Date.now()}`,
				rkey: old?.rkey ?? "",
				mediaType: resolvedMediaType,
				mediaId: target.mediaId,
				seasonNumber: target.seasonNumber,
				episodeNumber: target.episodeNumber,
				rating: variables.body.rating,
				content: variables.body.content,
				createdAt: old?.createdAt ?? now,
				updatedAt: now,
			}));
			return { prevReview };
		},
		onError: (error, _vars, context) => {
			if (context?.prevReview !== undefined) {
				queryClient.setQueryData(reviewKey, context.prevReview);
			}
			toast.error(error instanceof Error ? error.message : "Failed to save");
		},
		onSuccess: () => {
			void Haptics.notificationAsync(
				Haptics.NotificationFeedbackType.Success,
			).catch(() => {});
			toast.success("Review saved");
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: reviewKey });
			queryClient.invalidateQueries({ queryKey: mediaReviewsKey });
		},
	});

	const remove = useMutation({
		mutationKey: ["review", "delete", resolvedMediaType, target.mediaId],
		...reviewsControllerDeleteReviewMutation(),
		onMutate: async () => {
			await queryClient.cancelQueries({ queryKey: reviewKey });
			const prevReview = queryClient.getQueryData<ReviewResponseDto>(reviewKey);
			queryClient.setQueryData(reviewKey, null);
			return { prevReview };
		},
		onError: (error, _vars, context) => {
			if (context?.prevReview !== undefined) {
				queryClient.setQueryData(reviewKey, context.prevReview);
			}
			toast.error(error instanceof Error ? error.message : "Failed to delete");
		},
		onSuccess: () => {
			void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
				() => {},
			);
			toast.success("Review deleted");
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: reviewKey });
			queryClient.invalidateQueries({ queryKey: mediaReviewsKey });
		},
	});

	const saveReview = (rating: number, content?: string) => {
		if (!isAuthenticated) return;
		upsert.mutate({
			body: {
				mediaType: resolvedMediaType,
				mediaId: target.mediaId,
				seasonNumber: target.seasonNumber,
				episodeNumber: target.episodeNumber,
				rating,
				content: content?.trim() ? content.trim() : undefined,
			},
		});
	};

	const deleteReview = () => {
		if (!isAuthenticated || !review?.id) return;
		remove.mutate({ path: { reviewId: review.id } });
	};

	return {
		review,
		isLoading: reviewQuery.isLoading,
		saveReview,
		deleteReview,
		isSaving: upsert.isPending,
		isDeleting: remove.isPending,
	};
}
