import { Heart, Loader2, MessageSquare } from "lucide-react";
import { useAuth } from "#/lib/auth-context";
import { formatRelativeTime } from "#/lib/date-utils";
import { useMediaReviews, useToggleReviewLike } from "#/lib/hooks/useReviews";
import { MarkdownPreview } from "./MarkdownPreview";

interface CommunityReviewsProps {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
	onAddReview?: () => void;
}

/** Build the TMDB poster URL used as the review "cover" (the media poster). */
function posterUrl(posterPath?: string): string | undefined {
	return posterPath
		? `https://image.tmdb.org/t/p/w185${posterPath}`
		: undefined;
}

function ReviewCard({
	review,
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
	isOwnReview,
}: {
	review: {
		id: string;
		title: string;
		markdown: string;
		reviewUrl?: string;
		posterPath?: string;
		userDid: string;
		userHandle: string;
		userDisplayName?: string;
		userAvatar?: string;
		likeCount: number;
		hasLiked: boolean;
		createdAt: string;
	};
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
	isOwnReview: boolean;
}) {
	const { likeReview, unlikeReview, isLikePending, isUnlikePending } =
		useToggleReviewLike({
			mediaType,
			mediaId,
			seasonNumber,
			episodeNumber,
		});

	const isPending = isLikePending || isUnlikePending;
	const isLiked = review.hasLiked;

	const handleToggleLike = () => {
		if (isOwnReview || isPending) return;
		if (isLiked) {
			unlikeReview(review.id);
		} else {
			likeReview(review.id);
		}
	};

	const displayName = review.userDisplayName || review.userHandle;
	const avatarUrl =
		review.userAvatar || `https://i.pravatar.cc/150?u=${review.userDid}`;
	const cover = posterUrl(review.posterPath);

	// The canonical public review page (#115) may not exist as a registered
	// route yet, so we use a plain anchor rather than the router's typed Link.
	// The link shape is stable: /@handle/path on the public site (never the PDS
	// host). Falls back to plain text when the backend could not build a URL.
	const title = review.reviewUrl ? (
		<a
			href={review.reviewUrl}
			className="transition-colors hover:text-(--accent)"
		>
			{review.title}
		</a>
	) : (
		review.title
	);

	return (
		<div className={`card p-4 ${isOwnReview ? "border-(--accent)/30" : ""}`}>
			<div className="mb-3 flex items-start justify-between">
				<div className="flex items-center gap-3">
					<img
						src={avatarUrl}
						alt={displayName}
						className="size-10 rounded-full object-cover"
						loading="lazy"
					/>
					<div>
						<div className="flex items-center gap-2">
							<p className="font-medium text-sm">{displayName}</p>
							{isOwnReview && (
								<span className="badge badge-accent px-1.5 py-0 text-[10px]">
									Your Review
								</span>
							)}
						</div>
						<p className="text-(--foreground-muted) text-xs">
							@{review.userHandle}
						</p>
					</div>
				</div>
				<span className="text-(--foreground-muted) text-xs">
					{formatRelativeTime(review.createdAt)}
				</span>
			</div>

			<div className="flex gap-3">
				{cover &&
					(review.reviewUrl ? (
						<a
							href={review.reviewUrl}
							className="shrink-0"
							aria-label={`Open review: ${review.title}`}
						>
							<img
								src={cover}
								alt=""
								className="h-24 w-16 rounded-md object-cover"
								loading="lazy"
							/>
						</a>
					) : (
						<img
							src={cover}
							alt=""
							className="h-24 w-16 shrink-0 rounded-md object-cover"
							loading="lazy"
						/>
					))}
				<div className="min-w-0 flex-1">
					<h3 className="mb-1 font-display font-semibold">{title}</h3>
					<div className="text-(--foreground-muted)">
						<MarkdownPreview markdown={review.markdown} />
					</div>
				</div>
			</div>

			<div className="mt-3 flex items-center gap-2">
				<button
					type="button"
					onClick={handleToggleLike}
					disabled={isOwnReview || isPending}
					className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors ${
						isOwnReview
							? "cursor-not-allowed text-(--foreground-muted) opacity-50"
							: isLiked
								? "text-red-500 hover:bg-red-500/10"
								: "text-(--foreground-muted) hover:bg-(--background-subtle) hover:text-(--accent)"
					}`}
					aria-label={isLiked ? "Unlike review" : "Like review"}
				>
					{isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Heart className={`size-4 ${isLiked ? "fill-red-500" : ""}`} />
					)}
					<span>{review.likeCount}</span>
				</button>
			</div>
		</div>
	);
}

export default function CommunityReviews({
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
	onAddReview,
}: CommunityReviewsProps) {
	const { user, isAuthenticated } = useAuth();
	const { data, isLoading } = useMediaReviews({
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	const allReviews = data?.items ?? [];
	const ownReviews = allReviews.filter(
		(review) => review.userDid === user?.did,
	);
	const communityReviews = allReviews.filter(
		(review) => review.userDid !== user?.did,
	);
	const hasAnyReviews = allReviews.length > 0;

	if (isLoading) {
		return (
			<section>
				<h2 className="mb-4 text-display-3">Community Reviews</h2>
				<div className="space-y-4">
					{[1, 2, 3].map((n) => (
						<div key={`skeleton-${n}`} className="card h-32 animate-pulse p-4">
							<div className="mb-3 flex items-center gap-3">
								<div className="size-10 rounded-full bg-(--background-subtle)" />
								<div className="space-y-1.5">
									<div className="h-4 w-24 rounded bg-(--background-subtle)" />
									<div className="h-3 w-16 rounded bg-(--background-subtle)" />
								</div>
							</div>
							<div className="h-3 w-full rounded bg-(--background-subtle)" />
						</div>
					))}
				</div>
			</section>
		);
	}

	return (
		<section>
			<h2 className="mb-4 text-display-3">
				<MessageSquare className="mr-2 inline-block size-5" />
				Community Reviews
			</h2>
			{!hasAnyReviews ? (
				<div className="card p-6 text-center">
					{isAuthenticated ? (
						<div className="space-y-3">
							<p className="text-(--foreground-muted) text-sm">
								No reviews yet. Be the first to share your thoughts.
							</p>
							<button
								type="button"
								onClick={onAddReview}
								className="btn btn-secondary btn-sm gap-1"
							>
								<MessageSquare className="size-3.5" />
								Write a review
							</button>
						</div>
					) : (
						<p className="text-(--foreground-muted) text-sm">No reviews yet.</p>
					)}
				</div>
			) : (
				<div className="space-y-4">
					{ownReviews.map((review) => (
						<ReviewCard
							key={review.id}
							review={review}
							mediaType={mediaType}
							mediaId={mediaId}
							seasonNumber={seasonNumber}
							episodeNumber={episodeNumber}
							isOwnReview={true}
						/>
					))}
					{communityReviews.map((review) => (
						<ReviewCard
							key={review.id}
							review={review}
							mediaType={mediaType}
							mediaId={mediaId}
							seasonNumber={seasonNumber}
							episodeNumber={episodeNumber}
							isOwnReview={false}
						/>
					))}
				</div>
			)}
		</section>
	);
}
