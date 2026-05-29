import { Loader2, Pencil, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "#/lib/auth-context";
import { useClearRating, useRating } from "#/lib/hooks/useRatings";
import { useDeleteReview, useReview } from "#/lib/hooks/useReviews";
import { ReviewDialog } from "./ReviewDialog";
import StarRating from "./StarRating";

interface ReviewSectionProps {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

export default function ReviewSection({
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: ReviewSectionProps) {
	const { user, isAuthenticated } = useAuth();
	const userDid = user?.did ?? "";
	const [dialogOpen, setDialogOpen] = useState(false);

	const { data: ratingRecord, isLoading } = useRating({
		userDid,
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	// Review text still lives on the legacy review. TODO(#113).
	const { data: review } = useReview({
		userDid,
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	const clearRatingMutation = useClearRating({
		userDid,
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	const deleteReviewMutation = useDeleteReview({
		userDid,
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	if (!isAuthenticated) return null;

	if (isLoading) {
		return (
			<section className="card p-5">
				<div className="flex items-center gap-2 text-(--foreground-muted)">
					<Loader2 className="size-4 animate-spin" />
					<span className="text-sm">Loading review...</span>
				</div>
			</section>
		);
	}

	const handleDelete = () => {
		if (ratingRecord?.id) {
			clearRatingMutation.mutate({ path: { ratingId: ratingRecord.id } });
		}
		if (review?.id) {
			deleteReviewMutation.mutate({ path: { reviewId: review.id } });
		}
	};

	const isDeletePending =
		clearRatingMutation.isPending || deleteReviewMutation.isPending;
	const hasRating = !!ratingRecord?.rating;

	return (
		<>
			<section id="your-review" className="card p-5">
				<div className="mb-3 flex items-center justify-between">
					<h3 className="flex items-center gap-2 font-display font-semibold">
						<Star className="size-4 text-yellow-500" />
						Your Review
					</h3>
					{hasRating && (
						<div className="flex gap-1">
							<button
								type="button"
								onClick={() => setDialogOpen(true)}
								className="flex h-8 w-8 items-center justify-center rounded-md text-(--foreground-muted) transition-colors hover:bg-(--background-subtle) hover:text-(--accent)"
								aria-label="Edit review"
							>
								<Pencil className="size-4" />
							</button>
							<button
								type="button"
								onClick={handleDelete}
								disabled={isDeletePending}
								className="flex h-8 w-8 items-center justify-center rounded-md text-(--foreground-muted) transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
								aria-label="Delete review"
							>
								{isDeletePending ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<Trash2 className="size-4" />
								)}
							</button>
						</div>
					)}
				</div>

				{hasRating ? (
					<>
						<div className="mb-2">
							<StarRating value={ratingRecord.rating} readOnly showValue />
						</div>
						{review?.content && (
							<p className="whitespace-pre-wrap text-(--foreground-muted) text-sm leading-relaxed">
								{review.content}
							</p>
						)}
					</>
				) : (
					<>
						<p className="mb-3 text-(--foreground-muted) text-sm">
							No review yet. Rate this title and share your thoughts.
						</p>
						<button
							type="button"
							onClick={() => setDialogOpen(true)}
							className="btn btn-secondary btn-sm gap-1"
						>
							<Star className="size-3.5" />
							Add review
						</button>
					</>
				)}
			</section>

			<ReviewDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				mediaType={mediaType}
				mediaId={mediaId}
				seasonNumber={seasonNumber}
				episodeNumber={episodeNumber}
			/>
		</>
	);
}
