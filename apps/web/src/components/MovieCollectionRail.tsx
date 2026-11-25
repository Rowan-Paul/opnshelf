import {
	type MovieCollectionDto,
	movieCollectionRail,
	moviesControllerGetUserMovieWatchCountsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { useEffect, useRef } from "react";
import { useAuth } from "#/lib/auth-context";
import ActionableMediaCard from "./ActionableMediaCard";

const RAIL_ID = "movie-collection";

/**
 * The hero's link to the rail: names the collection and where this movie sits
 * in it, and scrolls the rail into view, which is below the fold on a phone.
 */
export function MovieCollectionEyebrow({
	collection,
	movieId,
}: {
	collection: MovieCollectionDto | undefined;
	movieId: string;
}) {
	const rail = movieCollectionRail(collection, movieId);
	if (!rail) return null;
	return (
		<button
			type="button"
			onClick={() =>
				document.getElementById(RAIL_ID)?.scrollIntoView({
					behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
						.matches
						? "auto"
						: "smooth",
					block: "center",
				})
			}
			// An opaque pill: the hero's backdrop is too uneven to carry small
			// text on its own.
			className="badge badge-subtle mb-2 max-w-full transition-colors hover:text-(--foreground)"
		>
			<Layers className="size-3 shrink-0" aria-hidden />
			<span className="truncate">
				{rail.name} · Movie {rail.position} of {rail.total}
			</span>
		</button>
	);
}

/**
 * Row of every movie in the collection this movie belongs to, for switching
 * between them the way a show page lists its seasons. Uses the same cards as
 * Similar Movies, so each one carries its shelf and list actions. Renders
 * nothing for a movie that stands alone.
 */
export function MovieCollectionRail({
	collection,
	movieId,
}: {
	collection: MovieCollectionDto | undefined;
	movieId: string;
}) {
	const { user, isAuthenticated } = useAuth();
	const { data: watchCounts } = useQuery({
		...moviesControllerGetUserMovieWatchCountsOptions({
			path: { userDid: user?.did ?? "" },
		}),
		enabled: isAuthenticated && !!user?.did,
	});
	const rail = movieCollectionRail(collection, movieId, watchCounts);
	const rowRef = useRef<HTMLUListElement>(null);
	const railSize = rail?.total ?? 0;

	// Keep this movie in the middle, so its neighbours on both sides show
	// however far into a long collection it sits.
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-centre when the page switches movie or the row first renders.
	useEffect(() => {
		const row = rowRef.current;
		const current = row?.querySelector<HTMLElement>("[aria-current]");
		if (!row || !current) return;
		const centre = () => {
			const rowBox = row.getBoundingClientRect();
			const cardBox = current.getBoundingClientRect();
			row.scrollLeft +=
				cardBox.left - rowBox.left - (rowBox.width - cardBox.width) / 2;
		};
		centre();
		// Again after the router has restored scroll for the new page, which
		// would otherwise put the row back where the last movie left it.
		const frame = requestAnimationFrame(centre);
		return () => cancelAnimationFrame(frame);
	}, [movieId, railSize]);

	if (!rail) return null;

	return (
		<section id={RAIL_ID} aria-labelledby={`${RAIL_ID}-heading`}>
			<div className="mb-3 flex items-baseline justify-between gap-4">
				<h2 id={`${RAIL_ID}-heading`} className="text-display-3">
					{rail.name} movies
				</h2>
				{isAuthenticated && (
					// Holds its place while the Watches load so the heading row
					// does not reflow when they arrive.
					<p
						className={`shrink-0 text-(--foreground-muted) text-sm tabular-nums ${watchCounts ? "" : "invisible"}`}
					>
						{rail.watchedCount} of {rail.total} watched
					</p>
				)}
			</div>
			<ul
				ref={rowRef}
				className="-mx-1.5 flex snap-x snap-proximity gap-3 overflow-x-auto px-1.5 pt-1.5 pb-2 [scrollbar-width:thin]"
			>
				{rail.items.map((item) => (
					<li
						key={item.id}
						aria-current={item.isCurrent ? "true" : undefined}
						className="relative flex-none snap-center"
					>
						<ActionableMediaCard
							id={item.id}
							title={item.title}
							posterUrl={
								item.posterPath
									? `https://image.tmdb.org/t/p/w500${item.posterPath}`
									: ""
							}
							type="movie"
							year={item.year ?? "TBA"}
							size="sm"
							layout="poster"
							interactive={isAuthenticated}
						/>
						{/* Lies over the card's poster: the place in the collection,
						    and the accent ring on the movie this page is about. */}
						<span
							className={`pointer-events-none absolute inset-x-0 top-0 block aspect-2/3 rounded-lg ${
								item.isCurrent
									? "outline-(--accent) outline-2 outline-offset-2"
									: ""
							}`}
						>
							<span className="absolute bottom-1.5 left-1.5 grid h-[22px] min-w-[22px] place-items-center rounded-md bg-black/70 px-1.5 font-semibold text-white text-xs tabular-nums">
								<span className="sr-only">Movie </span>
								{item.position}
							</span>
						</span>
					</li>
				))}
			</ul>
		</section>
	);
}
