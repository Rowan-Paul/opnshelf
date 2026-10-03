import {
	activeFeaturedItems,
	type FeaturedDto,
	featuredControllerAccessOptions,
	featuredControllerSelectionOptions,
	featuredTitle,
	scheduleFeaturedExpiry,
} from "@opnshelf/api";
import { hashKey, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Film } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "#/lib/auth-context";
import { buildMovieUrl, buildSeasonUrl, buildShowUrl } from "#/lib/url-utils";

export function FeaturedCard({ item }: { item: FeaturedDto }) {
	const [failedPoster, setFailedPoster] = useState<string | null>(null);
	return (
		<article className="flex w-[min(340px,82vw)] shrink-0 flex-col overflow-hidden rounded-2xl border border-(--border) bg-(--background-elevated)">
			<Link
				to={
					item.mediaType === "movie"
						? buildMovieUrl(item.mediaId, item.title)
						: item.mediaType === "season" && item.seasonNumber != null
							? buildSeasonUrl(item.mediaId, item.title, item.seasonNumber)
							: buildShowUrl(item.mediaId, item.title)
				}
				className="group flex flex-1 gap-4 p-4 focus-visible:outline-(--primary) focus-visible:outline-2"
			>
				<div className="h-36 w-24 shrink-0 overflow-hidden rounded-lg bg-(--background-subtle)">
					{item.posterPath && item.posterPath !== failedPoster ? (
						<img
							ref={(image) => {
								if (image?.complete && image.naturalWidth === 0)
									setFailedPoster(item.posterPath);
							}}
							src={`https://image.tmdb.org/t/p/w342${item.posterPath}`}
							alt=""
							className="size-full object-cover"
							loading="lazy"
							onError={() => setFailedPoster(item.posterPath)}
						/>
					) : (
						<Film className="m-auto mt-12 size-8 text-(--foreground-muted)" />
					)}
				</div>
				<div className="min-w-0">
					<h3 className="font-display font-semibold text-base group-hover:underline">
						{featuredTitle(item)}
					</h3>
					<p className="mt-2 whitespace-pre-wrap break-words text-(--foreground-muted) text-sm leading-relaxed">
						{item.message}
					</p>
				</div>
			</Link>
			{item.sourceUrl && (
				<a
					href={item.sourceUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center justify-between border-(--border) border-t px-4 py-3 font-medium text-sm hover:bg-(--background-subtle)"
				>
					{item.sourceLabel}
					<ArrowUpRight className="size-4" aria-hidden="true" />
				</a>
			)}
		</article>
	);
}
export function FeaturedContent() {
	const { user } = useAuth();
	const access = useQuery({
		...featuredControllerAccessOptions(),
		queryKeyHashFn: (key) => hashKey([...key, user?.did]),
		enabled: !!user,
		retry: false,
	});
	const selection = useQuery({
		...featuredControllerSelectionOptions(),
		staleTime: 0,
		refetchInterval: 30_000,
	});
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		if (selection.data?.items)
			return scheduleFeaturedExpiry(selection.data.items, setNow);
	}, [selection.data?.items]);
	const items = activeFeaturedItems(selection.data?.items ?? [], now);
	const canEdit = !!user && access.data?.canEdit;
	if (!selection.isPending && items.length === 0)
		return canEdit ? (
			<p className="mb-4 text-right text-sm">
				<Link to="/admin/featured" className="underline">
					Manage featured content
				</Link>
			</p>
		) : null;
	return (
		<section className="mb-8" aria-label="Featured Content">
			<div className="mb-3 flex items-center justify-between gap-3">
				<h2 className="font-display font-semibold text-xl">Featured Content</h2>
				{canEdit && (
					<Link
						to="/admin/featured"
						className="text-sm underline underline-offset-4"
					>
						Manage entries
					</Link>
				)}
			</div>
			{selection.isPending ? (
				<div
					className="flex gap-4 overflow-hidden"
					aria-busy="true"
					data-testid="featured-skeleton"
				>
					{[1, 2].map((id) => (
						<div
							key={id}
							className="flex h-52 w-[min(340px,82vw)] shrink-0 gap-4 rounded-2xl border border-(--border) p-4 motion-safe:animate-pulse"
						>
							<div className="h-36 w-24 rounded-lg bg-(--background-subtle)" />
							<div className="flex-1 space-y-3">
								<div className="h-5 rounded bg-(--background-subtle)" />
								<div className="h-20 rounded bg-(--background-subtle)" />
							</div>
						</div>
					))}
				</div>
			) : items.length > 0 ? (
				<div className="flex items-stretch gap-4 overflow-x-auto pb-3">
					{items.map((item) => (
						<FeaturedCard key={item.id} item={item} />
					))}
				</div>
			) : canEdit ? (
				<p className="text-(--foreground-muted) text-sm">
					No active entries. Publish one to feature it here.
				</p>
			) : null}
		</section>
	);
}
