import {
	type BlueskyCrossPostResultDto,
	type MediaReviewItemDto,
	ratingsControllerClearRatingMutation,
	ratingsControllerGetRatingOptions,
	ratingsControllerGetRatingQueryKey,
	ratingsControllerSetRatingMutation,
	reviewsControllerCreateReviewMutation,
	reviewsControllerDeleteReviewMutation,
	reviewsControllerGetMediaReviewsOptions,
	reviewsControllerGetMediaReviewsQueryKey,
	reviewsControllerRetryBlueskyCrossPostMutation,
	reviewsControllerUpdateReviewMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Linking } from "react-native";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";

interface ReviewTarget {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
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

export interface ReviewDraft {
	/** Long-form review title (required). */
	title: string;
	/** Long-form review body as markdown source. */
	markdown: string;
	/** Whether to mirror this review to the author's blog (when configured). */
	mirrorToBlog?: boolean;
	/** Whether to create a one-time Bluesky post for this new Review. */
	postToBluesky?: boolean;
}

/**
 * Rating and review are two independent entities on the backend: the star
 * rating lives on `/ratings` (one per media item, set/clear), while reviews are
 * long-form markdown documents on `/reviews` (zero-or-many per media item,
 * create/update/delete). This hook reads the current user's rating and *all* of
 * their own reviews for a media item and exposes focused operations for each, so
 * the detail screen can drive a standalone rating control and a "Your Reviews"
 * list separately.
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

	const ratingKey = ratingsControllerGetRatingQueryKey({
		path: { userDid },
		query: {
			mediaType: resolvedMediaType,
			mediaId: target.mediaId,
			seasonNumber: target.seasonNumber,
			episodeNumber: target.episodeNumber,
		},
	});

	const mediaReviewsKey = reviewsControllerGetMediaReviewsQueryKey({
		query: {
			mediaType: resolvedMediaType,
			mediaId: target.mediaId,
			seasonNumber: target.seasonNumber,
			episodeNumber: target.episodeNumber,
		},
	});

	const enabled = isAuthenticated && !!userDid && !!target.mediaId;

	const ratingQuery = useQuery({
		...ratingsControllerGetRatingOptions({
			path: { userDid },
			query: {
				mediaType: resolvedMediaType,
				mediaId: target.mediaId,
				seasonNumber: target.seasonNumber,
				episodeNumber: target.episodeNumber,
			},
		}),
		enabled,
	});

	const reviewsQuery = useQuery({
		...reviewsControllerGetMediaReviewsOptions({
			query: {
				mediaType: resolvedMediaType,
				mediaId: target.mediaId,
				seasonNumber: target.seasonNumber,
				episodeNumber: target.episodeNumber,
			},
		}),
		enabled: isAuthenticated && !!target.mediaId,
	});

	const ratingRecord = ratingQuery.data ?? null;
	// Reviews are zero-or-many per user per media item; surface them all.
	const reviews: MediaReviewItemDto[] = (reviewsQuery.data?.items ?? []).filter(
		(item) => item.userDid === userDid,
	);

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ratingKey });
		queryClient.invalidateQueries({ queryKey: mediaReviewsKey });
	};

	const setRatingMutation = useMutation({
		mutationKey: ["ratings", "set", resolvedMediaType, target.mediaId],
		...ratingsControllerSetRatingMutation(),
	});
	const clearRatingMutation = useMutation({
		mutationKey: ["ratings", "clear", resolvedMediaType, target.mediaId],
		...ratingsControllerClearRatingMutation(),
	});
	const createReviewMutation = useMutation({
		mutationKey: ["reviews", "create", resolvedMediaType, target.mediaId],
		...reviewsControllerCreateReviewMutation(),
	});
	const updateReviewMutation = useMutation({
		mutationKey: ["reviews", "update", resolvedMediaType, target.mediaId],
		...reviewsControllerUpdateReviewMutation(),
	});
	const deleteReviewMutation = useMutation({
		mutationKey: ["reviews", "delete", resolvedMediaType, target.mediaId],
		...reviewsControllerDeleteReviewMutation(),
	});
	const retryBlueskyMutation = useMutation({
		mutationKey: ["reviews", "blueskyCrossPost", "retry"],
		...reviewsControllerRetryBlueskyCrossPostMutation(),
	});

	const showBlueskyResult = (
		result: BlueskyCrossPostResultDto,
		reviewId: string,
	): void => {
		if (result.status === "posted" && result.url) {
			toast.success("Posted to Bluesky", {
				action: {
					label: "View post",
					onPress: () => {
						void Linking.openURL(result.url as string);
					},
				},
			});
			return;
		}
		if (result.status === "failed") {
			toast.error("Couldn't post to Bluesky", {
				action: {
					label: "Retry",
					onPress: () => {
						retryBlueskyMutation.mutate(
							{ path: { reviewId } },
							{
								onSuccess: (retryResult) =>
									showBlueskyResult(retryResult, reviewId),
								onError: () =>
									showBlueskyResult({ status: "failed" }, reviewId),
							},
						);
					},
				},
			});
		}
	};

	/** Set (or update) the single star rating for this media item. */
	const setRating = async (rating: number) => {
		if (!isAuthenticated || rating <= 0) return;
		try {
			await setRatingMutation.mutateAsync({
				body: {
					mediaType: resolvedMediaType,
					mediaId: target.mediaId,
					seasonNumber: target.seasonNumber,
					episodeNumber: target.episodeNumber,
					rating,
				},
			});
			void Haptics.notificationAsync(
				Haptics.NotificationFeedbackType.Success,
			).catch(() => {});
			toast.success("Rating saved");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to save");
		} finally {
			invalidate();
		}
	};

	/** Clear the star rating, leaving any reviews intact. */
	const clearRating = async () => {
		if (!isAuthenticated || !ratingRecord) return;
		try {
			await clearRatingMutation.mutateAsync({
				path: { ratingId: ratingRecord.id },
			});
			void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
				() => {},
			);
			toast.success("Rating cleared");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to clear rating",
			);
		} finally {
			invalidate();
		}
	};

	/** Create a new long-form review for this media item. */
	const createReview = async ({
		title,
		markdown,
		mirrorToBlog,
		postToBluesky,
	}: ReviewDraft) => {
		if (!isAuthenticated) return;
		const trimmedTitle = title.trim();
		const trimmedBody = markdown.trim();
		if (!trimmedTitle || !trimmedBody) return;
		try {
			const created = await createReviewMutation.mutateAsync({
				body: {
					mediaType: resolvedMediaType,
					mediaId: target.mediaId,
					seasonNumber: target.seasonNumber,
					episodeNumber: target.episodeNumber,
					title: trimmedTitle,
					markdown: trimmedBody,
					mirrorToBlog,
					postToBluesky,
				},
			});
			void Haptics.notificationAsync(
				Haptics.NotificationFeedbackType.Success,
			).catch(() => {});
			toast.success("Review published");
			showBlueskyResult(created.blueskyCrossPost, created.id);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to save");
		} finally {
			invalidate();
		}
	};

	/** Update an existing review's title/body. */
	const updateReview = async (
		reviewId: string,
		{ title, markdown, mirrorToBlog }: ReviewDraft,
	) => {
		if (!isAuthenticated) return;
		const trimmedTitle = title.trim();
		const trimmedBody = markdown.trim();
		if (!trimmedTitle || !trimmedBody) return;
		try {
			await updateReviewMutation.mutateAsync({
				path: { reviewId },
				body: { title: trimmedTitle, markdown: trimmedBody, mirrorToBlog },
			});
			void Haptics.notificationAsync(
				Haptics.NotificationFeedbackType.Success,
			).catch(() => {});
			toast.success("Review saved");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to save");
		} finally {
			invalidate();
		}
	};

	/** Delete a review document, leaving the rating intact. */
	const deleteReview = async (reviewId: string) => {
		if (!isAuthenticated) return;
		try {
			await deleteReviewMutation.mutateAsync({ path: { reviewId } });
			void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
				() => {},
			);
			toast.success("Review deleted");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to delete");
		} finally {
			invalidate();
		}
	};

	return {
		rating: ratingRecord?.rating ?? 0,
		hasRating: !!ratingRecord,
		reviews,
		isLoading: ratingQuery.isLoading || reviewsQuery.isLoading,
		setRating,
		clearRating,
		createReview,
		updateReview,
		deleteReview,
		isSettingRating: setRatingMutation.isPending,
		isClearingRating: clearRatingMutation.isPending,
		isSavingReview:
			createReviewMutation.isPending || updateReviewMutation.isPending,
		isDeletingReview: deleteReviewMutation.isPending,
	};
}
