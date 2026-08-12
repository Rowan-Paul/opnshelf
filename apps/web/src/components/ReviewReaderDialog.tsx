import {
	reviewsControllerGetCanonicalReviewOptions,
	slugifyName,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarDays, ExternalLink, Loader2 } from "lucide-react";
import { UserAvatar } from "#/components/following/UserAvatar";
import { MarkdownContent } from "#/components/MarkdownContent";
import { ShareButton } from "#/components/ShareButton";
import { SpoilerShield } from "#/components/SpoilerShield";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";

function parseReviewUrl(reviewUrl: string | null) {
	if (!reviewUrl) return null;
	const parts = reviewUrl.split("/").filter(Boolean);
	const reviewsIndex = parts.lastIndexOf("reviews");
	if (
		reviewsIndex < 0 ||
		!parts[reviewsIndex + 1] ||
		!parts[reviewsIndex + 2]
	) {
		return null;
	}
	return { handle: parts[reviewsIndex + 1], rkey: parts[reviewsIndex + 2] };
}

function mediaHref(review: {
	mediaType: string;
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
	mediaTitle?: string | null;
}) {
	const slug = slugifyName(review.mediaTitle?.split(" — ")[0] ?? "");
	switch (review.mediaType) {
		case "movie":
			return `/movies/${review.mediaId}/${slug}`;
		case "show":
			return `/shows/${review.mediaId}/${slug}`;
		case "season":
			return `/shows/${review.mediaId}/${slug}/seasons/${review.seasonNumber}`;
		case "episode":
			return `/shows/${review.mediaId}/${slug}/seasons/${review.seasonNumber}/episodes/${review.episodeNumber}`;
		default:
			return "/";
	}
}

/**
 * A full review reader that is opened from a media detail page. The media page
 * remains visible behind it, keeping a first-time visitor oriented, while the
 * canonical review URL remains the durable share target.
 */
export function ReviewReaderDialog({
	reviewUrl,
	onOpenChange,
}: {
	reviewUrl: string | null;
	onOpenChange: (open: boolean) => void;
}) {
	const reference = parseReviewUrl(reviewUrl);
	const {
		data: review,
		isLoading,
		isError,
	} = useQuery({
		...reviewsControllerGetCanonicalReviewOptions({
			path: { handle: reference?.handle ?? "", rkey: reference?.rkey ?? "" },
		}),
		enabled: Boolean(reference),
	});

	return (
		<Dialog open={Boolean(reviewUrl)} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90dvh] overflow-y-auto p-0 sm:max-w-3xl">
				{isLoading ? (
					<div className="flex min-h-64 items-center justify-center">
						<Loader2 className="size-6 animate-spin text-(--foreground-muted)" />
					</div>
				) : isError || !review ? (
					<DialogHeader className="p-6 text-left">
						<DialogTitle>Couldn’t load this review</DialogTitle>
						<DialogDescription>
							Try opening the review in its own page instead.
						</DialogDescription>
						{reviewUrl && (
							<a className="btn btn-secondary mt-2 w-fit" href={reviewUrl}>
								Open review page
							</a>
						)}
					</DialogHeader>
				) : (
					<article>
						<div className="border-(--border) border-b bg-(--background-subtle) px-6 py-5 pr-14">
							<p className="font-medium text-(--foreground-muted) text-xs uppercase tracking-[0.14em]">
								Review of {review.mediaTitle ?? "this title"}
							</p>
							<DialogTitle className="mt-2 font-display text-2xl leading-tight sm:text-3xl">
								{review.reviewTitle}
							</DialogTitle>
						</div>

						<div className="p-6 sm:p-8">
							<div className="mb-7 flex items-center justify-between gap-4 border-(--border) border-b pb-5">
								<Link
									to="/profile/$handle"
									params={{ handle: review.author.handle }}
									className="flex min-w-0 items-center gap-3 transition-colors hover:text-(--accent)"
								>
									<UserAvatar
										src={review.author.avatar ?? undefined}
										alt={review.author.displayName || review.author.handle}
										className="size-9 shrink-0 rounded-full"
									/>
									<span className="min-w-0">
										<span className="block truncate font-medium text-sm">
											{review.author.displayName || review.author.handle}
										</span>
										<span className="block truncate text-(--foreground-muted) text-xs">
											@{review.author.handle}
										</span>
									</span>
								</Link>
								<span className="flex shrink-0 items-center gap-1.5 text-(--foreground-muted) text-xs">
									<CalendarDays className="size-3.5" />
									{new Date(review.createdAt).toLocaleDateString()}
								</span>
							</div>

							<div className="mx-auto max-w-[42rem] text-(--foreground)">
								<SpoilerShield
									spoiler={review.spoiler}
									authorDid={review.author.did}
								>
									<MarkdownContent markdown={review.markdown} />
								</SpoilerShield>
							</div>
						</div>

						<div className="flex flex-wrap items-center justify-between gap-3 border-(--border) border-t bg-(--background-subtle) px-6 py-4">
							<div className="flex flex-wrap items-center gap-2">
								<Link
									to={mediaHref(review)}
									className="btn btn-secondary btn-sm"
								>
									Explore {review.mediaTitle ?? "title"}
								</Link>
								{reviewUrl && (
									<ShareButton
										url={`${mediaHref(review)}?review=${encodeURIComponent(reviewUrl)}`}
										surface="review_reader"
									/>
								)}
							</div>
							<a
								href={reviewUrl ?? undefined}
								className="btn btn-ghost btn-sm gap-1.5"
							>
								Open review page <ExternalLink className="size-3.5" />
							</a>
						</div>
					</article>
				)}
			</DialogContent>
		</Dialog>
	);
}
