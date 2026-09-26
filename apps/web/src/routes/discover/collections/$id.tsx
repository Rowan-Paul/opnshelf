import {
	getHttpStatus,
	type NotificationCollectionItemDto,
	notificationsControllerCollection,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bookmark, Check } from "lucide-react";
import { useAuth } from "#/lib/auth-context";
import { useListActions } from "#/lib/hooks/useListActions";
import { useListItemStatus } from "#/lib/hooks/useListItemStatus";

export const Route = createFileRoute("/discover/collections/$id")({
	head: () => ({
		meta: [
			{ title: "Release collection | Opnshelf" },
			{ name: "robots", content: "noindex" },
		],
	}),
	component: NotificationCollectionPage,
});

export function NotificationCollectionPage() {
	const { id } = Route.useParams();
	const { user, isAuthenticated, isLoading: authLoading } = useAuth();
	const query = useQuery({
		queryFn: async ({ signal }) =>
			(
				await notificationsControllerCollection({
					path: { id },
					signal,
					throwOnError: true,
				})
			).data,
		queryKey: ["notification-collection", user?.did, id],
		enabled: isAuthenticated,
		retry: (count, error) => getHttpStatus(error) !== 404 && count < 2,
	});
	const collection = isAuthenticated ? query.data : undefined;
	return (
		<div className="container-app max-w-5xl py-8">
			<Link
				to="/search"
				className="mb-6 inline-flex items-center gap-2 text-(--foreground-muted) text-sm"
			>
				<ArrowLeft className="size-4" />
				Discover
			</Link>
			{!authLoading && !isAuthenticated ? (
				<section className="space-y-4">
					<h1 className="font-bold font-display text-3xl">
						Your release collection
					</h1>
					<p>
						Sign in to the account that received this notification, then open
						its link again.
					</p>
					<Link to="/login" className="btn btn-primary">
						Sign in
					</Link>
				</section>
			) : collection ? (
				<>
					<header className="mb-8 space-y-3">
						<p className="font-semibold text-(--foreground-muted) text-sm">
							{collection.periodStart === collection.periodEnd
								? formatDate(collection.periodStart)
								: `${formatDate(collection.periodStart)} – ${formatDate(collection.periodEnd)}`}
						</p>
						<h1 className="font-bold font-display text-3xl sm:text-4xl">
							{collection.heading}
						</h1>
						<p className="text-(--foreground-muted)">
							{collection.items.length}{" "}
							{collection.items.length === 1 ? "title" : "titles"} to explore.
							Find your next watch.
						</p>
					</header>
					<div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
						{collection.items.map((item) => (
							<CollectionItem key={item.path} item={item} />
						))}
					</div>
				</>
			) : query.isError ? (
				<section role="alert" className="space-y-4">
					<h1 className="font-bold font-display text-2xl">
						{getHttpStatus(query.error) === 404
							? "Collection unavailable"
							: "Couldn’t load this collection"}
					</h1>
					<p>
						{getHttpStatus(query.error) === 404
							? "Check that you’re signed in to the account that received this notification."
							: "Please try again."}
					</p>
					{getHttpStatus(query.error) !== 404 && (
						<button
							type="button"
							className="btn btn-secondary"
							onClick={() => void query.refetch()}
						>
							Try again
						</button>
					)}
				</section>
			) : (
				<CollectionSkeleton />
			)}
		</div>
	);
}

function formatDate(date: string) {
	return new Date(`${date}T12:00:00Z`).toLocaleDateString("en", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	});
}

function CollectionItem({ item }: { item: NotificationCollectionItemDto }) {
	const target = {
		mediaType: item.mediaType,
		mediaId: item.mediaId,
		seasonNumber: item.seasonNumber ?? undefined,
	};
	const { listsForItem, isInWatchlist } = useListItemStatus(target);
	const { toggleWatchlist, isPending } = useListActions(target);
	return (
		<article className="flex items-start gap-4">
			<Link
				to={item.path}
				className="w-24 shrink-0 sm:w-28"
				aria-label={`View ${item.title}`}
			>
				{item.posterPath ? (
					<img
						src={`https://image.tmdb.org/t/p/w342${item.posterPath}`}
						alt={`${item.title} poster`}
						loading="lazy"
						className="aspect-2/3 w-full rounded-lg bg-(--background-subtle) object-cover"
					/>
				) : (
					<div className="flex aspect-2/3 items-center justify-center rounded-lg bg-(--background-subtle) p-3 text-center text-(--foreground-muted) text-xs">
						No poster
					</div>
				)}
			</Link>
			<div className="min-w-0 flex-1 space-y-3">
				<div>
					<p className="mb-1 text-(--foreground-muted) text-xs">
						{item.seasonNumber
							? `Season ${item.seasonNumber}`
							: item.mediaType === "movie"
								? "Movie"
								: "Show"}
						{item.releaseDate
							? ` · ${formatDate(item.releaseDate)}`
							: " · Date unavailable"}
					</p>
					<h2 className="font-bold font-display text-xl">
						<Link to={item.path}>{item.title}</Link>
					</h2>
				</div>
				{item.overview && (
					<p className="line-clamp-4 text-(--foreground-muted) text-sm leading-relaxed">
						{item.overview}
					</p>
				)}
				<Link
					to={item.path}
					className="inline-block text-sm underline underline-offset-4"
				>
					View details
				</Link>
				<div>
					<button
						type="button"
						disabled={isPending || !listsForItem}
						aria-busy={isPending}
						aria-label={`${isInWatchlist ? "Remove" : "Add"} ${item.title} ${isInWatchlist ? "from" : "to"} Watchlist`}
						className="btn btn-secondary inline-flex items-center gap-2 text-sm disabled:opacity-50"
						onClick={() => toggleWatchlist(isInWatchlist)}
					>
						{isInWatchlist ? (
							<Check className="size-4" />
						) : (
							<Bookmark className="size-4" />
						)}
						{isInWatchlist ? "In Watchlist" : "Watchlist"}
					</button>
				</div>
			</div>
		</article>
	);
}

function CollectionSkeleton() {
	return (
		<section
			aria-label="Loading release collection"
			aria-busy="true"
			className="motion-safe:animate-pulse"
		>
			<div className="mb-3 h-4 w-40 rounded bg-(--background-subtle)" />
			<div className="mb-8 h-10 w-3/4 rounded bg-(--background-subtle)" />
			<div className="grid gap-8 md:grid-cols-2">
				{[0, 1, 2, 3].map((key) => (
					<div key={key} className="flex gap-4">
						<div className="aspect-2/3 w-24 shrink-0 rounded-lg bg-(--background-subtle) sm:w-28" />
						<div className="flex-1 space-y-3">
							<div className="h-6 w-3/4 rounded bg-(--background-subtle)" />
							<div className="h-20 rounded bg-(--background-subtle)" />
							<div className="h-10 w-28 rounded bg-(--background-subtle)" />
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
