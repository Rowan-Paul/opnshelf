import { Loader2, Pencil, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "#/lib/auth-context";
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

	const { data: review, isLoading } = useReview({
		userDid,
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	const deleteMutation = useDeleteReview({
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

	return (
		<>
			<section id="your-review" className="card p-5">
				<div className="mb-3 flex items-center justify-between">
					<h3 className="flex items-center gap-2 font-display font-semibold">
						<Star className="size-4 text-yellow-500" />
						Your Review
					</h3>
					{review?.rating && (
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
								onClick={() =>
									review.id &&
									deleteMutation.mutate({ path: { reviewId: review.id } })
								}
								disabled={deleteMutation.isPending}
								className="flex h-8 w-8 items-center justify-center rounded-md text-(--foreground-muted) transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
								aria-label="Delete review"
							>
								{deleteMutation.isPending ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<Trash2 className="size-4" />
								)}
							</button>
						</div>
					)}
				</div>

				{review?.rating ? (
					<>
						<div className="mb-2">
							<StarRating value={review.rating} readOnly showValue />
						</div>
						{review.content && (
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
