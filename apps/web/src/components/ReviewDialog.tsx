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

	const prevUpsertPending = useRef(false);
	const prevDeletePending = useRef(false);

	useEffect(() => {
		if (
			prevUpsertPending.current &&
			!upsertMutation.isPending &&
			upsertMutation.isSuccess
		) {
			onOpenChange(false);
			onSuccess?.();
			upsertMutation.reset();
		}
		prevUpsertPending.current = upsertMutation.isPending;
	}, [upsertMutation, onOpenChange, onSuccess]);

	useEffect(() => {
		if (
			prevDeletePending.current &&
			!deleteMutation.isPending &&
			deleteMutation.isSuccess
		) {
			onOpenChange(false);
			onSuccess?.();
			deleteMutation.reset();
		}
		prevDeletePending.current = deleteMutation.isPending;
	}, [deleteMutation, onOpenChange, onSuccess]);

	useEffect(() => {
		if (open) {
			setRating(review?.rating ?? 0);
			setContent(review?.content ?? "");
		}
	}, [open, review?.rating, review?.content]);

	const handleSave = () => {
		if (rating === 0) {
			if (review?.id) {
				deleteMutation.mutate({ path: { reviewId: review.id } });
			} else {
				onOpenChange(false);
			}
			return;
		}
		upsertMutation.mutate({
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
		});
	};

	const handleDelete = () => {
		if (!review?.id) return;
		deleteMutation.mutate({ path: { reviewId: review.id } });
	};

	const isPending = upsertMutation.isPending || deleteMutation.isPending;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Star className="size-4 text-yellow-500" />
						{review?.rating ? "Edit Review" : "Add a Review"}
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
						{review?.id && (
							<button
								type="button"
								onClick={handleDelete}
								disabled={isPending}
								className="btn btn-ghost btn-sm gap-1 text-red-500 hover:text-red-600"
							>
								{deleteMutation.isPending && (
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
							{upsertMutation.isPending ? (
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
