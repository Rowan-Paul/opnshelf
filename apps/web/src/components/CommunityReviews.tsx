import { Link, useLocation } from "@tanstack/react-router";
import { Heart, Loader2, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "#/lib/auth-context";
import { formatRelativeTime } from "#/lib/date-utils";
import {
	useDeleteReview,
	useMediaReviews,
	useToggleReviewLike,
} from "#/lib/hooks/useReviews";
import ConfirmDialog from "./ConfirmDialog";
import { UserAvatar } from "./following/UserAvatar";
import { ReviewBody } from "./ReviewBody";
import { ReviewDialog } from "./ReviewDialog";
import { ReviewReaderDialog } from "./ReviewReaderDialog";
import { ShareButton } from "./ShareButton";
import { SpoilerShield } from "./SpoilerShield";

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
	isAuthenticated,
	onOpenReview,
}: {
	review: {
		id: string;
		reviewTitle: string;
		markdown: string;
		spoiler: boolean;
		reviewUrl?: string;
		posterPath?: string;
		userDid: string;
		userHandle: string;
		userDisplayName?: string;
		userAvatar?: string;
		likeCount: number;
		hasLiked: boolean;
		mirrorToBlog?: boolean;
		createdAt: string;
	};
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
	isOwnReview: boolean;
	isAuthenticated: boolean;
	onOpenReview: (reviewUrl: string) => void;
}) {
	const { likeReview, unlikeReview, isLikePending, isUnlikePending } =
		useToggleReviewLike({
			mediaType,
			mediaId,
			seasonNumber,
			episodeNumber,
		});

	const deleteMutation = useDeleteReview({
		userDid: review.userDid,
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	const [confirmOpen, setConfirmOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);

	// When linked-to via #review-<id> (e.g. from the profile reviews list),
	// scroll this card into view and flash it. The card only renders once the
	// media-reviews query has resolved, so this effect inherently runs after the
	// target review is loaded. Strip a leading "#" defensively — routers differ.
	const cardRef = useRef<HTMLDivElement>(null);
	const rawHash = useLocation({ select: (l) => l.hash });
	const isHighlighted =
		(rawHash ?? "").replace(/^#/, "") === `review-${review.id}`;
	useEffect(() => {
		if (!isHighlighted) return;
		// Land on the TOP of the review (block: "start" + scroll-mt), not its
		// centre — a long highlighted review is tall, so centring it looks like
		// stopping "halfway". Re-scroll a couple of times because sections above
		// (cast, providers, similar) finish loading after this fires and push the
		// review further down.
		const scroll = () =>
			cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
		scroll();
		const t1 = setTimeout(scroll, 400);
		const t2 = setTimeout(scroll, 1000);
		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
		};
	}, [isHighlighted]);

	const isPending = isLikePending || isUnlikePending;
	const isLiked = review.hasLiked;
	// Mirrors mobile's `canLike`: only signed-in viewers can toggle a like, and
	// never on your own review — logged-out viewers just see the read-only count.
	const canLike = isAuthenticated && !isOwnReview;

	const handleToggleLike = () => {
		if (!canLike || isPending) return;
		if (isLiked) {
			unlikeReview(review.id);
		} else {
			likeReview(review.id);
		}
	};

	const handleDelete = () => {
		deleteMutation.mutate(
			{ path: { reviewId: review.id } },
			{ onSuccess: () => setConfirmOpen(false) },
		);
	};

	const displayName = review.userDisplayName || review.userHandle;
	const cover = posterUrl(review.posterPath);
	const openReview = (event: React.MouseEvent<HTMLAnchorElement>) => {
		if (!review.reviewUrl) return;
		event.preventDefault();
		onOpenReview(review.reviewUrl);
	};

	// The canonical public review page (#115) may not exist as a registered
	// route yet, so we use a plain anchor rather than the router's typed Link.
	// The link shape is stable: /reviews/{handle}/{rkey} on the public site
	// (never the PDS host). Falls back to plain text when the backend could not
	// build a URL.
	const title = review.reviewUrl ? (
		<a
			href={review.reviewUrl}
			onClick={openReview}
			className="transition-colors hover:text-(--accent)"
		>
			{review.reviewTitle}
		</a>
	) : (
		review.reviewTitle
	);

	return (
		<div
			ref={cardRef}
			id={`review-${review.id}`}
			className={`card relative scroll-mt-24 p-4 ${
				isOwnReview ? "border-(--accent)/30" : ""
			}`}
		>
			{isHighlighted && (
				<div className="pointer-events-none absolute inset-0 z-[2] animate-review-flash rounded-[inherit]" />
			)}
			<div className="relative z-[1] mb-3 flex items-start justify-between gap-2">
				<Link
					to="/profile/$handle"
					params={{ handle: review.userHandle }}
					className="flex min-w-0 items-center gap-3"
				>
					<UserAvatar
						src={review.userAvatar}
						alt={displayName}
						className="size-10 shrink-0 rounded-full"
					/>
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<p className="truncate font-medium text-sm transition-colors hover:text-(--accent)">
								{displayName}
							</p>
							{isOwnReview && (
								<span className="badge badge-accent shrink-0 px-1.5 py-0 text-[10px]">
									Your Review
								</span>
							)}
						</div>
						<p className="truncate text-(--foreground-muted) text-xs">
							@{review.userHandle} · {formatRelativeTime(review.createdAt)}
						</p>
					</div>
				</Link>
				{isOwnReview && (
					<div className="flex shrink-0 items-center gap-1">
						<button
							type="button"
							onClick={() => setEditOpen(true)}
							className="flex h-7 w-7 items-center justify-center rounded-md text-(--foreground-muted) transition-colors hover:bg-(--background-subtle) hover:text-(--accent)"
							aria-label="Edit review"
						>
							<Pencil className="size-3.5" />
						</button>
						<button
							type="button"
							onClick={() => setConfirmOpen(true)}
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

			<div className="flex gap-3">
				{cover &&
					(review.reviewUrl ? (
						<a
							href={review.reviewUrl}
							onClick={openReview}
							className="shrink-0"
							aria-label={`Open review: ${review.reviewTitle}`}
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
						<SpoilerShield spoiler={review.spoiler} authorDid={review.userDid}>
							<ReviewBody
								markdown={review.markdown}
								href={review.reviewUrl}
								onReadMoreClick={openReview}
							/>
						</SpoilerShield>
					</div>
				</div>
			</div>

			<div className="mt-3 flex items-center gap-2">
				<button
					type="button"
					onClick={handleToggleLike}
					disabled={!canLike || isPending}
					className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors ${
						!canLike
							? "cursor-not-allowed text-(--foreground-muted) opacity-50"
							: isLiked
								? "text-red-500 hover:bg-red-500/10"
								: "text-(--foreground-muted) hover:bg-(--background-subtle) hover:text-(--accent)"
					}`}
					aria-label={
						!isAuthenticated
							? `${review.likeCount} likes`
							: isLiked
								? "Unlike review"
								: "Like review"
					}
				>
					{isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Heart className={`size-4 ${isLiked ? "fill-red-500" : ""}`} />
					)}
					<span>{review.likeCount}</span>
				</button>
				{review.reviewUrl && (
					// Relative to the current media page: sharing keeps the reader here
					// with this review open, same target as the Bluesky cross-post.
					<ShareButton
						url={`?review=${encodeURIComponent(review.reviewUrl)}`}
						surface="review_card"
						className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-(--foreground-muted) text-sm transition-colors hover:bg-(--background-subtle) hover:text-(--accent)"
					/>
				)}
			</div>

			{isOwnReview && (
				<>
					<ReviewDialog
						open={editOpen}
						onOpenChange={setEditOpen}
						mediaType={mediaType}
						mediaId={mediaId}
						seasonNumber={seasonNumber}
						episodeNumber={episodeNumber}
						review={{
							id: review.id,
							title: review.reviewTitle,
							markdown: review.markdown,
							mirrorToBlog: review.mirrorToBlog,
							spoiler: review.spoiler,
						}}
						scrollTargetId={`review-${review.id}`}
					/>
					<ConfirmDialog
						open={confirmOpen}
						onOpenChange={setConfirmOpen}
						title="Delete review?"
						description={
							<>
								This permanently deletes your review{" "}
								<strong>{review.reviewTitle}</strong> from your shelf. This
								action cannot be undone.
							</>
						}
						confirmLabel="Delete review"
						pendingLabel="Deleting..."
						onConfirm={handleDelete}
						isPending={deleteMutation.isPending}
					/>
				</>
			)}
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
	const [openReviewUrl, setOpenReviewUrl] = useState<string | null>(() => {
		if (typeof window === "undefined") return null;
		return new URLSearchParams(window.location.search).get("review");
	});

	useEffect(() => {
		const syncFromHistory = () =>
			setOpenReviewUrl(
				new URLSearchParams(window.location.search).get("review"),
			);
		window.addEventListener("popstate", syncFromHistory);
		return () => window.removeEventListener("popstate", syncFromHistory);
	}, []);

	const openReview = (reviewUrl: string) => {
		const url = new URL(window.location.href);
		url.searchParams.set("review", reviewUrl);
		window.history.pushState(
			{ ...window.history.state, reviewOverlay: true },
			"",
			url,
		);
		setOpenReviewUrl(reviewUrl);
	};

	const setReviewOpen = (open: boolean) => {
		if (open || !openReviewUrl) return;
		if (window.history.state?.reviewOverlay) {
			window.history.back();
			return;
		}
		const url = new URL(window.location.href);
		url.searchParams.delete("review");
		window.history.replaceState(window.history.state, "", url);
		setOpenReviewUrl(null);
	};

	// If we were deep-linked to a specific review (#review-<id>), pin it so the
	// server includes it even when it ranks past the first page of results.
	const rawHash = useLocation({ select: (l) => l.hash });
	const pinnedReviewId =
		(rawHash ?? "").replace(/^#/, "").match(/^review-(.+)$/)?.[1] ?? undefined;

	const { data, isLoading } = useMediaReviews({
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
		pinnedReviewId,
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
			<section id="community-reviews">
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
		<section id="community-reviews">
			<div className="mb-4 flex items-center justify-between gap-2">
				<h2 className="text-display-3">
					<MessageSquare className="mr-2 inline-block size-5" />
					Community Reviews
				</h2>
				{isAuthenticated && (
					<button
						type="button"
						onClick={onAddReview}
						className="btn btn-secondary btn-sm shrink-0 gap-1"
					>
						<MessageSquare className="size-3.5" />
						Write a review
					</button>
				)}
			</div>
			{!hasAnyReviews ? (
				<div className="card p-6 text-center">
					<p className="text-(--foreground-muted) text-sm">
						{isAuthenticated
							? "No reviews yet. Be the first to share your thoughts."
							: "No reviews yet."}
					</p>
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
							isAuthenticated={isAuthenticated}
							onOpenReview={openReview}
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
							isAuthenticated={isAuthenticated}
							onOpenReview={openReview}
							isOwnReview={false}
						/>
					))}
				</div>
			)}
			{openReviewUrl && (
				<ReviewReaderDialog
					reviewUrl={openReviewUrl}
					onOpenChange={setReviewOpen}
				/>
			)}
		</section>
	);
}
