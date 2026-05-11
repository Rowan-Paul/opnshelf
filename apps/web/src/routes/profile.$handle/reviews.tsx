import {
	reviewsControllerDeleteReviewMutation,
	reviewsControllerGetUserReviewsQueryKey,
	reviewsControllerUpsertReviewMutation,
	type UserReviewDto,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Pencil, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import StarRating from "#/components/StarRating";
import { useAuth } from "#/lib/auth-context";
import { useUserReviews } from "#/lib/hooks/useReviews";
import { toSlug } from "#/lib/slug";

export const Route = createFileRoute("/profile/$handle/reviews")({
	component: ProfileReviewsPage,
});

function ProfileReviewsPage() {
	const { handle } = Route.useParams();
	const { user } = useAuth();

	const { data: profile } = useQuery({
		...usersControllerGetPublicProfileOptions({ path: { handle } }),
	});
	const userDid = profile?.did || "";
	const isOwner = user?.did === userDid;

	const [cursor, setCursor] = useState<string | undefined>(undefined);

	const { data, isLoading } = useUserReviews({ userDid, limit: 20, cursor });

	const reviews = data?.items ?? [];
	const hasMore = data?.nextCursor != null;

	return (
		<div className="space-y-6">
			<h1 className="text-display-2">Reviews</h1>

			{isLoading ? (
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					{[1, 2, 3, 4].map((i) => (
						<div key={i} className="card flex gap-4 p-4">
							<div className="h-24 w-16 shrink-0 animate-pulse rounded-md bg-(--background-subtle)" />
							<div className="flex-1 space-y-2">
								<div className="h-4 w-3/4 animate-pulse rounded bg-(--background-subtle)" />
								<div className="h-3 w-1/2 animate-pulse rounded bg-(--background-subtle)" />
								<div className="h-3 w-full animate-pulse rounded bg-(--background-subtle)" />
							</div>
						</div>
					))}
				</div>
			) : reviews.length === 0 ? (
				<div className="card p-8 text-center">
					<p className="text-(--foreground-muted)">
						{isOwner ? "You haven't reviewed anything yet." : "No reviews yet."}
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					{reviews.map((review) => (
						<ReviewCard
							key={review.id}
							review={review}
							isOwner={isOwner}
							userDid={userDid}
						/>
					))}
				</div>
			)}

			{hasMore && (
				<div className="flex justify-center">
					<button
						type="button"
						onClick={() => setCursor(data?.nextCursor ?? undefined)}
						className="btn btn-secondary"
					>
						Load more
					</button>
				</div>
			)}
		</div>
	);
}

function ReviewCard({
	review,
	isOwner,
	userDid,
}: {
	review: UserReviewDto;
	isOwner: boolean;
	userDid: string;
}) {
	const queryClient = useQueryClient();
	const [isEditing, setIsEditing] = useState(false);
	const [draftRating, setDraftRating] = useState(review.rating);
	const [draftContent, setDraftContent] = useState(review.content || "");

	const upsertMutation = useMutation({
		...reviewsControllerUpsertReviewMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: reviewsControllerGetUserReviewsQueryKey({
					path: { userDid },
					query: { limit: 20 },
				}),
			});
			toast.success("Review updated");
			setIsEditing(false);
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to update review",
			);
		},
	});

	const deleteMutation = useMutation({
		...reviewsControllerDeleteReviewMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: reviewsControllerGetUserReviewsQueryKey({
					path: { userDid },
					query: { limit: 20 },
				}),
			});
			toast.success("Review deleted");
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete review",
			);
		},
	});

	const href =
		review.mediaType === "movie"
			? `/movies/${review.mediaId}/${toSlug(review.title || "")}`
			: `/shows/${review.mediaId}/${toSlug(review.title || "")}`;

	const handleSave = () => {
		if (draftRating === 0) {
			deleteMutation.mutate({ path: { reviewId: review.id } });
			return;
		}
		upsertMutation.mutate({
			body: {
				mediaType: review.mediaType,
				mediaId: review.mediaId,
				seasonNumber: review.seasonNumber,
				episodeNumber: review.episodeNumber,
				rating: draftRating,
				content: draftContent.trim() || undefined,
			},
		});
	};

	const handleCancel = () => {
		setDraftRating(review.rating);
		setDraftContent(review.content || "");
		setIsEditing(false);
	};

	const handleDelete = () => {
		deleteMutation.mutate({ path: { reviewId: review.id } });
	};

	const handleRatingChange = (newRating: number) => {
		if (!isOwner || isEditing) return;
		upsertMutation.mutate({
			body: {
				mediaType: review.mediaType,
				mediaId: review.mediaId,
				seasonNumber: review.seasonNumber,
				episodeNumber: review.episodeNumber,
				rating: newRating,
				content: review.content,
			},
		});
	};

	return (
		<div className="card p-4">
			<div className="flex gap-4">
				{review.posterPath && (
					<Link to={href}>
						<img
							src={`https://image.tmdb.org/t/p/w200${review.posterPath}`}
							alt={review.title || "Poster"}
							className="h-24 w-16 shrink-0 rounded-md object-cover"
						/>
					</Link>
				)}
				<div className="flex-1 space-y-2">
					<div className="flex items-center justify-between">
						<h3 className="font-medium text-sm">{review.title || "Unknown"}</h3>
						<div className="flex items-center gap-2">
							<span className="text-(--foreground-muted) text-xs">
								{new Date(review.createdAt).toLocaleDateString()}
							</span>
							{isOwner && !isEditing && (
								<div className="flex gap-1">
									<button
										type="button"
										onClick={() => setIsEditing(true)}
										className="flex h-7 w-7 items-center justify-center rounded-md text-(--foreground-muted) transition-colors hover:bg-(--background-subtle) hover:text-(--accent)"
										aria-label="Edit review"
									>
										<Pencil className="size-3.5" />
									</button>
									<button
										type="button"
										onClick={handleDelete}
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
							)}
						</div>
					</div>

					{isEditing ? (
						<div className="space-y-3">
							<StarRating
								value={draftRating}
								onChange={(v) => setDraftRating(v)}
								size="sm"
							/>
							<textarea
								value={draftContent}
								onChange={(e) => setDraftContent(e.target.value)}
								placeholder="Write your review... (optional)"
								className="input min-h-[80px] resize-none text-sm"
								maxLength={5000}
							/>
							<div className="flex items-center justify-between">
								<span className="text-(--foreground-subtle) text-xs">
									{draftContent.length}/5000
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
										disabled={
											upsertMutation.isPending || deleteMutation.isPending
										}
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
						</div>
					) : (
						<>
							<StarRating
								value={review.rating}
								onChange={isOwner ? handleRatingChange : undefined}
								readOnly={!isOwner}
								size="sm"
								showValue
							/>
							{review.content && (
								<p className="text-(--foreground-muted) text-sm leading-relaxed">
									{review.content}
								</p>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
}
