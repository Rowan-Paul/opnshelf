import { reviewsControllerGetCanonicalReviewOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { UserAvatar } from "#/components/following/UserAvatar";
import { MarkdownPreview } from "#/components/MarkdownPreview";
import { toSlug } from "#/lib/slug";

export const Route = createFileRoute("/@{$handle}/$segment")({
	loader: async ({ context, params }) => {
		try {
			const review = await context.queryClient.ensureQueryData(
				reviewsControllerGetCanonicalReviewOptions({
					path: { handle: params.handle, segment: params.segment },
				}),
			);
			return { review };
		} catch (error) {
			if (
				typeof error === "object" &&
				error !== null &&
				("status" in error || "statusCode" in error) &&
				((error as Record<string, unknown>).status === 404 ||
					(error as Record<string, unknown>).statusCode === 404)
			) {
				throw notFound();
			}
			throw error;
		}
	},
	head: ({ loaderData }) => {
		const title = loaderData?.review.title ?? "Review";
		const author =
			loaderData?.review.author.displayName ||
			loaderData?.review.author.handle ||
			"";
		return {
			meta: [
				{ title: `${title} | OpnShelf` },
				{
					name: "description",
					content:
						loaderData?.review.description ??
						`A review by ${author} on OpnShelf.`,
				},
			],
		};
	},
	component: CanonicalReviewPage,
});

/** Link back to the media page this review is about. */
function mediaHref(review: {
	mediaType: string;
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
	mediaTitle?: string | null;
}): string {
	// The media title carries the show name as the first " — "-separated part.
	const baseName = review.mediaTitle?.split(" — ")[0] ?? "";
	const slug = toSlug(baseName);
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

function CanonicalReviewPage() {
	const { handle, segment } = Route.useParams();
	const { review: loaderReview } = Route.useLoaderData();

	// Re-fetch on the client so the page stays fresh, but always fall back to the
	// SSR loader data so it renders fully when logged out / before hydration.
	const { data: liveReview } = useQuery({
		...reviewsControllerGetCanonicalReviewOptions({
			path: { handle, segment },
		}),
	});
	const review = liveReview ?? loaderReview;

	const posterUrl = review.posterPath
		? `https://image.tmdb.org/t/p/w300${review.posterPath}`
		: null;
	const created = new Date(review.createdAt);
	const updated = new Date(review.updatedAt);
	const wasUpdated = updated.getTime() - created.getTime() > 60_000;

	return (
		<article className="container-app py-8">
			<Link
				to={mediaHref(review)}
				className="mb-6 inline-flex items-center gap-1.5 text-(--foreground-muted) text-sm transition-colors hover:text-(--foreground)"
			>
				<ArrowLeft className="size-4" />
				{review.mediaTitle ?? "Back to media"}
			</Link>

			<div className="flex flex-col gap-6 sm:flex-row">
				{posterUrl && (
					<Link
						to={mediaHref(review)}
						className="block w-32 shrink-0 self-center sm:self-start"
					>
						<img
							src={posterUrl}
							alt={review.mediaTitle ?? review.title}
							className="aspect-2/3 w-full rounded-lg border border-(--border) object-cover"
						/>
					</Link>
				)}

				<div className="min-w-0 flex-1">
					<h1 className="text-display-2">{review.title}</h1>

					<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-(--foreground-muted) text-sm">
						<Link
							to="/profile/$handle"
							params={{ handle: review.author.handle }}
							className="flex items-center gap-2 transition-colors hover:text-(--foreground)"
						>
							<span className="flex size-7 items-center justify-center overflow-hidden rounded-full border border-(--border) bg-(--background-elevated)">
								<UserAvatar
									src={review.author.avatar ?? undefined}
									alt={review.author.displayName || review.author.handle}
									className="h-full w-full rounded-full"
								/>
							</span>
							<span>{review.author.displayName || review.author.handle}</span>
						</Link>
						<span className="flex items-center gap-1.5">
							<CalendarDays className="size-4" />
							{created.toLocaleDateString()}
							{wasUpdated && (
								<span className="text-(--foreground-subtle)">
									(updated {updated.toLocaleDateString()})
								</span>
							)}
						</span>
					</div>

					<div className="mt-6 text-(--foreground)">
						<MarkdownPreview markdown={review.markdown} />
					</div>
				</div>
			</div>
		</article>
	);
}
