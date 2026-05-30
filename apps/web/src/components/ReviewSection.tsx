import { Loader2, MessageSquarePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "#/lib/auth-context";
import { useDeleteReview, useMediaReviews } from "#/lib/hooks/useReviews";
import { MarkdownContent } from "./MarkdownContent";
import { type EditableReview, ReviewDialog } from "./ReviewDialog";

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
	const [editing, setEditing] = useState<EditableReview | undefined>();

	const { data, isLoading } = useMediaReviews({
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

	const myReviews = (data?.items ?? []).filter((r) => r.userDid === userDid);

	const openCreate = () => {
		setEditing(undefined);
		setDialogOpen(true);
	};

	const openEdit = (review: EditableReview) => {
		setEditing(review);
		setDialogOpen(true);
	};

	return (
		<>
			<section id="your-reviews" className="card p-5">
				<div className="mb-3 flex items-center justify-between">
					<h3 className="flex items-center gap-2 font-display font-semibold">
						<MessageSquarePlus className="size-4 text-(--accent)" />
						Your Reviews
					</h3>
					<button
						type="button"
						onClick={openCreate}
						className="btn btn-secondary btn-sm gap-1"
					>
						<Plus className="size-3.5" />
						Write
					</button>
				</div>

				{isLoading ? (
					<div className="flex items-center gap-2 text-(--foreground-muted)">
						<Loader2 className="size-4 animate-spin" />
						<span className="text-sm">Loading reviews...</span>
					</div>
				) : myReviews.length === 0 ? (
					<p className="text-(--foreground-muted) text-sm">
						No reviews yet. Share your thoughts on this title.
					</p>
				) : (
					<ul className="space-y-4">
						{myReviews.map((review) => (
							<li
								key={review.id}
								className="border-(--border) border-b pb-4 last:border-b-0 last:pb-0"
							>
								<div className="mb-1 flex items-start justify-between gap-2">
									<h4 className="font-medium text-sm">{review.title}</h4>
									<div className="flex shrink-0 gap-1">
										<button
											type="button"
											onClick={() =>
												openEdit({
													id: review.id,
													title: review.title,
													markdown: review.markdown,
												})
											}
											className="flex h-7 w-7 items-center justify-center rounded-md text-(--foreground-muted) transition-colors hover:bg-(--background-subtle) hover:text-(--accent)"
											aria-label="Edit review"
										>
											<Pencil className="size-3.5" />
										</button>
										<button
											type="button"
											onClick={() =>
												deleteMutation.mutate({ path: { reviewId: review.id } })
											}
											disabled={deleteMutation.isPending}
											className="flex h-7 w-7 items-center justify-center rounded-md text-(--foreground-muted) transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
											aria-label="Delete review"
										>
											{deleteMutation.isPending ? (
												<Loader2 className="size-3.5 animate-spin" />
											) : (
												<Trash2 className="size-3.5" />
											)}
										</button>
									</div>
								</div>
								<div className="text-(--foreground-muted)">
									<MarkdownContent markdown={review.markdown} />
								</div>
							</li>
						))}
					</ul>
				)}
			</section>

			<ReviewDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				mediaType={mediaType}
				mediaId={mediaId}
				seasonNumber={seasonNumber}
				episodeNumber={episodeNumber}
				review={editing}
			/>
		</>
	);
}
