import {
	type MediaReviewItemDto,
	ratingsControllerClearRatingMutation,
	ratingsControllerGetRatingOptions,
	ratingsControllerGetRatingQueryKey,
	ratingsControllerSetRatingMutation,
	reviewsControllerCreateReviewMutation,
	reviewsControllerDeleteReviewMutation,
	reviewsControllerGetMediaReviewsOptions,
	reviewsControllerGetMediaReviewsQueryKey,
	reviewsControllerUpdateReviewMutation,
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

function resolveMediaType(
	mediaType: "movie" | "show",
	seasonNumber?: number,
	episodeNumber?: number,
): "movie" | "show" | "season" | "episode" {
	if (episodeNumber != null) return "episode";
	if (seasonNumber != null) return "season";
	return mediaType;
}

export interface SaveReviewInput {
	/** Star rating on the 1-10 scale (0 to leave unrated). */
	rating: number;
	/** Long-form review title (required when `markdown` is non-empty). */
	title?: string;
	/** Long-form review body as markdown source. */
	markdown?: string;
}

/**
 * Rating and review are two separate entities on the backend: the star rating
 * lives on `/ratings` (set/clear), while a review is a long-form markdown
 * document (`title` + `markdown`) on `/reviews` (create/update/delete). This
 * hook reads the current user's rating and own review for a media item and
 * exposes a single `save` that fans the inputs out to both endpoints, so the
 * detail screen can keep one "rate & review" sheet.
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
	const ownReview: MediaReviewItemDto | null =
		reviewsQuery.data?.items.find((item) => item.userDid === userDid) ?? null;

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ratingKey });
		queryClient.invalidateQueries({ queryKey: mediaReviewsKey });
	};

	const setRating = useMutation({
		mutationKey: ["ratings", "set", resolvedMediaType, target.mediaId],
		...ratingsControllerSetRatingMutation(),
	});
	const clearRating = useMutation({
		mutationKey: ["ratings", "clear", resolvedMediaType, target.mediaId],
		...ratingsControllerClearRatingMutation(),
	});
	const createReview = useMutation({
		mutationKey: ["reviews", "create", resolvedMediaType, target.mediaId],
		...reviewsControllerCreateReviewMutation(),
	});
	const updateReview = useMutation({
		mutationKey: ["reviews", "update", resolvedMediaType, target.mediaId],
		...reviewsControllerUpdateReviewMutation(),
	});
	const deleteReview = useMutation({
		mutationKey: ["reviews", "delete", resolvedMediaType, target.mediaId],
		...reviewsControllerDeleteReviewMutation(),
	});

	/**
	 * Persist the rating and/or the review in one call. Rating and review are
	 * independent: a rating is written only when `rating > 0`, and the review is
	 * created/updated only when a markdown body is supplied (which requires a
	 * title). Either, both, or neither may be present.
	 */
	const saveReview = async ({ rating, title, markdown }: SaveReviewInput) => {
		if (!isAuthenticated) return;

		const trimmedTitle = title?.trim() ?? "";
		const trimmedBody = markdown?.trim() ?? "";

		if (rating <= 0 && !trimmedBody) return;

		try {
			if (rating > 0) {
				await setRating.mutateAsync({
					body: {
						mediaType: resolvedMediaType,
						mediaId: target.mediaId,
						seasonNumber: target.seasonNumber,
						episodeNumber: target.episodeNumber,
						rating,
					},
				});
			}

			if (trimmedBody) {
				if (ownReview) {
					await updateReview.mutateAsync({
						path: { reviewId: ownReview.id },
						body: { title: trimmedTitle, markdown: trimmedBody },
					});
				} else {
					await createReview.mutateAsync({
						body: {
							mediaType: resolvedMediaType,
							mediaId: target.mediaId,
							seasonNumber: target.seasonNumber,
							episodeNumber: target.episodeNumber,
							title: trimmedTitle,
							markdown: trimmedBody,
						},
					});
				}
			}

			void Haptics.notificationAsync(
				Haptics.NotificationFeedbackType.Success,
			).catch(() => {});
			toast.success(trimmedBody ? "Review saved" : "Rating saved");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to save");
		} finally {
			invalidate();
		}
	};

	/** Clear only the star rating, leaving any review intact. */
	const removeRating = async () => {
		if (!isAuthenticated || !ratingRecord) return;
		try {
			await clearRating.mutateAsync({ path: { ratingId: ratingRecord.id } });
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

	/** Delete only the review document, leaving any rating intact. */
	const removeReview = async () => {
		if (!isAuthenticated || !ownReview) return;
		try {
			await deleteReview.mutateAsync({ path: { reviewId: ownReview.id } });
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
		review: ownReview,
		hasRating: !!ratingRecord,
		hasReviewDoc: !!ownReview,
		hasReview: !!ownReview || !!ratingRecord,
		isLoading: ratingQuery.isLoading || reviewsQuery.isLoading,
		saveReview,
		clearRating: removeRating,
		deleteReview: removeReview,
		isSaving:
			setRating.isPending || createReview.isPending || updateReview.isPending,
		isClearingRating: clearRating.isPending,
		isDeleting: deleteReview.isPending,
	};
}
