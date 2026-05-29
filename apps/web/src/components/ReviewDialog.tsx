import { Loader2, Save, Star, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { useAuth } from "#/lib/auth-context";
import {
	useClearRating,
	useRating,
	useSetRating,
} from "#/lib/hooks/useRatings";
import {
	useDeleteReview,
	useReview,
	useUpsertReview,
} from "#/lib/hooks/useReviews";
import StarRating from "./StarRating";

interface ReviewDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
	onSuccess?: () => void;
}

export function ReviewDialog({
	open,
	onOpenChange,
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
	onSuccess,
}: ReviewDialogProps) {
	const { user } = useAuth();
	const userDid = user?.did ?? "";

	// The 1-10 score is its own entity (xyz.opnshelf.rating).
	const { data: ratingRecord } = useRating({
		userDid,
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});
	const setRatingMutation = useSetRating({
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

	// The optional long-form text still lives on the legacy review.
	// TODO(#113): convert review text into a site.standard.document.
	const { data: review } = useReview({
		userDid,
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	const upsertMutation = useUpsertReview({
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

	const [rating, setRating] = useState(0);
	const [content, setContent] = useState("");

	const wasPending = useRef(false);

	const isPending =
		setRatingMutation.isPending ||
		clearRatingMutation.isPending ||
		upsertMutation.isPending ||
		deleteMutation.isPending;

	useEffect(() => {
		const succeeded =
			setRatingMutation.isSuccess ||
			clearRatingMutation.isSuccess ||
			upsertMutation.isSuccess ||
			deleteMutation.isSuccess;

		if (wasPending.current && !isPending && succeeded) {
			onOpenChange(false);
			onSuccess?.();
			setRatingMutation.reset();
			clearRatingMutation.reset();
			upsertMutation.reset();
			deleteMutation.reset();
		}
		wasPending.current = isPending;
	}, [
		isPending,
		setRatingMutation,
		clearRatingMutation,
		upsertMutation,
		deleteMutation,
		onOpenChange,
		onSuccess,
	]);

	useEffect(() => {
		if (open) {
			setRating(ratingRecord?.rating ?? 0);
			setContent(review?.content ?? "");
		}
	}, [open, ratingRecord?.rating, review?.content]);

	const resolvedMediaType =
		episodeNumber != null
			? "episode"
			: seasonNumber != null
				? "season"
				: mediaType;

	const handleSave = () => {
		const trimmed = content.trim();

		if (rating === 0) {
			// Clearing the score: remove the rating, and any existing review text.
			if (ratingRecord?.id) {
				clearRatingMutation.mutate({ path: { ratingId: ratingRecord.id } });
			}
			if (review?.id) {
				deleteMutation.mutate({ path: { reviewId: review.id } });
			}
			if (!ratingRecord?.id && !review?.id) {
				onOpenChange(false);
			}
			return;
		}

		// Persist the score as a Rating entity.
		setRatingMutation.mutate({
			body: {
				mediaType: resolvedMediaType,
				mediaId,
				seasonNumber,
				episodeNumber,
				rating,
			},
		});

		// Long-form text remains a review for now.
		// TODO(#113): split review text into its own document entity; the
		// review currently still carries a rating to satisfy the legacy schema.
		if (trimmed) {
			upsertMutation.mutate({
				body: {
					mediaType: resolvedMediaType,
					mediaId,
					seasonNumber,
					episodeNumber,
					rating,
					content: trimmed,
				},
			});
		} else if (review?.id) {
			deleteMutation.mutate({ path: { reviewId: review.id } });
		}
	};

	const handleDelete = () => {
		if (ratingRecord?.id) {
			clearRatingMutation.mutate({ path: { ratingId: ratingRecord.id } });
		}
		if (review?.id) {
			deleteMutation.mutate({ path: { reviewId: review.id } });
		}
	};

	const hasExisting = !!ratingRecord?.id || !!review?.id;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Star className="size-4 text-yellow-500" />
						{hasExisting ? "Edit Review" : "Add a Review"}
					</DialogTitle>
					<DialogDescription className="sr-only">
						Add or edit your rating and review for this title.
					</DialogDescription>
				</DialogHeader>
				<div>
					<p className="mb-2 text-(--foreground-muted) text-sm">Rating</p>
					<StarRating value={rating} onChange={setRating} size="lg" />
				</div>
				<textarea
					value={content}
					onChange={(e) => setContent(e.target.value)}
					placeholder="Write your review... (optional)"
					className="input min-h-[120px] resize-none text-sm"
					maxLength={5000}
				/>
				<div className="flex items-center justify-between">
					<span className="text-(--foreground-subtle) text-xs">
						{content.length}/5000
					</span>
					<div className="flex gap-2">
						{hasExisting && (
							<button
								type="button"
								onClick={handleDelete}
								disabled={isPending}
								className="btn btn-ghost btn-sm gap-1 text-red-500 hover:text-red-600"
							>
								{(deleteMutation.isPending ||
									clearRatingMutation.isPending) && (
									<Loader2 className="size-3.5 animate-spin" />
								)}
								Delete
							</button>
						)}
						<button
							type="button"
							onClick={() => onOpenChange(false)}
							className="btn btn-secondary btn-sm gap-1"
						>
							<X className="size-3.5" />
							Cancel
						</button>
						<button
							type="button"
							onClick={handleSave}
							disabled={isPending}
							className="btn btn-primary btn-sm gap-1"
						>
							{setRatingMutation.isPending || upsertMutation.isPending ? (
								<Loader2 className="size-3.5 animate-spin" />
							) : (
								<Save className="size-3.5" />
							)}
							Save
						</button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
