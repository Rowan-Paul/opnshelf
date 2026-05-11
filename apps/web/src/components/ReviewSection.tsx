import { Loader2, Pencil, Save, Star, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "#/lib/auth-context";
import {
	useDeleteReview,
	useReview,
	useUpsertReview,
} from "#/lib/hooks/useReviews";
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
	const userDid = user?.did || "";

	const { data: review, isLoading } = useReview({
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

	const [isEditing, setIsEditing] = useState(false);
	const [rating, setRating] = useState(0);
	const [content, setContent] = useState("");

	useEffect(() => {
		if (isEditing) {
			setRating(review?.rating || 0);
			setContent(review?.content || "");
		}
	}, [isEditing, review?.rating, review?.content]);

	if (!isAuthenticated) {
		return null;
	}

	const handleSave = () => {
		if (rating === 0) {
			if (review?.id) {
				deleteMutation.mutate(
					{ path: { reviewId: review.id } },
					{
						onSuccess: () => setIsEditing(false),
					},
				);
			}
			return;
		}

		upsertMutation.mutate(
			{
				body: {
					mediaType:
						episodeNumber != null
							? "episode"
							: seasonNumber != null
								? "season"
								: mediaType,
					mediaId,
					seasonNumber,
					episodeNumber,
					rating,
					content: content.trim() || undefined,
				},
			},
			{
				onSuccess: () => setIsEditing(false),
			},
		);
	};

	const handleDelete = () => {
		if (!review?.id) return;
		deleteMutation.mutate(
			{ path: { reviewId: review.id } },
			{
				onSuccess: () => setIsEditing(false),
			},
		);
	};

	const handleCancel = () => {
		setRating(review?.rating || 0);
		setContent(review?.content || "");
		setIsEditing(false);
	};

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

	// View mode with existing review
	if (review?.rating && !isEditing) {
		return (
			<section className="card p-5">
				<div className="mb-3 flex items-center justify-between">
					<h3 className="flex items-center gap-2 font-display font-semibold">
						<Star className="size-4 text-yellow-500" />
						Your Review
					</h3>
					<div className="flex gap-1">
						<button
							type="button"
							onClick={() => setIsEditing(true)}
							className="flex h-8 w-8 items-center justify-center rounded-md text-(--foreground-muted) transition-colors hover:bg-(--background-subtle) hover:text-(--accent)"
							aria-label="Edit review"
						>
							<Pencil className="size-4" />
						</button>
						<button
							type="button"
							onClick={handleDelete}
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
				</div>
				<div className="mb-2">
					<StarRating value={review.rating} readOnly showValue />
				</div>
				{review.content && (
					<p className="whitespace-pre-wrap text-(--foreground-muted) text-sm leading-relaxed">
						{review.content}
					</p>
				)}
			</section>
		);
	}

	// Edit mode (new or existing)
	if (isEditing) {
		return (
			<section className="card p-5">
				<h3 className="mb-3 flex items-center gap-2 font-display font-semibold">
					<Star className="size-4 text-yellow-500" />
					{review?.rating ? "Edit Review" : "Add a Review"}
				</h3>
				<div className="mb-3">
					<p className="mb-1 text-(--foreground-muted) text-sm">Rating</p>
					<StarRating value={rating} onChange={(v) => setRating(v)} size="lg" />
				</div>
				<textarea
					value={content}
					onChange={(e) => setContent(e.target.value)}
					placeholder="Write your review... (optional)"
					className="input min-h-[100px] resize-none text-sm"
					maxLength={5000}
				/>
				<div className="mt-3 flex items-center justify-between">
					<span className="text-(--foreground-subtle) text-xs">
						{content.length}/5000
					</span>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={handleCancel}
							className="btn btn-secondary btn-sm gap-1"
						>
							<X className="size-3.5" />
							Cancel
						</button>
						<button
							type="button"
							onClick={handleSave}
							disabled={upsertMutation.isPending}
							className="btn btn-primary btn-sm gap-1"
						>
							{upsertMutation.isPending ? (
								<Loader2 className="size-3.5 animate-spin" />
							) : (
								<Save className="size-3.5" />
							)}
							Save
						</button>
					</div>
				</div>
			</section>
		);
	}

	// Empty state
	return (
		<section className="card p-5">
			<h3 className="mb-3 flex items-center gap-2 font-display font-semibold">
				<Star className="size-4 text-yellow-500" />
				Your Review
			</h3>
			<p className="mb-3 text-(--foreground-muted) text-sm">
				No review yet. Rate this title and share your thoughts.
			</p>
			<button
				type="button"
				onClick={() => setIsEditing(true)}
				className="btn btn-secondary btn-sm gap-1"
			>
				<Star className="size-3.5" />
				Add review
			</button>
		</section>
	);
}
