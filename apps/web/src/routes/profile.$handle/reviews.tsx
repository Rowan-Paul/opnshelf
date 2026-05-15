import {
	reviewsControllerDeleteReviewMutation,
	reviewsControllerGetUserReviewsQueryKey,
	type UserReviewDto,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { ProfileContentCard } from "#/components/ProfileContentCard";
import { ReviewDialog } from "#/components/ReviewDialog";
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
						<div key={i} className="card flex gap-4 p-4 sm:p-5">
							<div className="h-28 w-20 shrink-0 animate-pulse rounded-lg bg-(--background-subtle) sm:h-36 sm:w-24" />
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
	const [dialogOpen, setDialogOpen] = useState(false);

	const deleteMutation = useMutation({
		...reviewsControllerDeleteReviewMutation(),
	});

	const baseMediaType =
		review.mediaType === "movie" ? "movie" : ("show" as const);

	const invalidateList = () =>
		queryClient.invalidateQueries({
			queryKey: reviewsControllerGetUserReviewsQueryKey({
				path: { userDid },
				query: { limit: 20 },
			}),
		});

	const handleDelete = () => {
		deleteMutation.mutate(
			{ path: { reviewId: review.id } },
			{ onSuccess: invalidateList },
		);
	};

	const showName = review.title?.split(" — ")[0] ?? "";
	const slug = toSlug(showName);

	const href = (() => {
		if (review.mediaType === "movie") {
			return `/movies/${review.mediaId}/${slug}`;
		}
		if (review.mediaType === "show") {
			return `/shows/${review.mediaId}/${slug}`;
		}
		if (review.mediaType === "season") {
			return `/shows/${review.mediaId}/${slug}/seasons/${review.seasonNumber}`;
		}
		if (review.mediaType === "episode") {
			return `/shows/${review.mediaId}/${slug}/seasons/${review.seasonNumber}/episodes/${review.episodeNumber}`;
		}
		return "#";
	})();

	const posterUrl = review.posterPath
		? `https://image.tmdb.org/t/p/w300${review.posterPath}`
		: null;

	return (
		<>
			<ProfileContentCard
				posterUrl={posterUrl}
				to={href}
				title={review.title || "Unknown"}
				headerRight={
					<div className="flex items-center gap-2">
						<span className="text-(--foreground-muted) text-xs">
							{new Date(review.createdAt).toLocaleDateString()}
						</span>
						{isOwner && (
							<div className="flex gap-1">
								<button
									type="button"
									onClick={() => setDialogOpen(true)}
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
				}
			>
				<StarRating value={review.rating} readOnly size="sm" showValue />
				{review.content && (
					<p className="text-(--foreground-muted) text-sm leading-relaxed">
						{review.content}
					</p>
				)}
			</ProfileContentCard>
			<ReviewDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				mediaType={baseMediaType}
				mediaId={review.mediaId}
				seasonNumber={review.seasonNumber ?? undefined}
				episodeNumber={review.episodeNumber ?? undefined}
				onSuccess={invalidateList}
			/>
		</>
	);
}
