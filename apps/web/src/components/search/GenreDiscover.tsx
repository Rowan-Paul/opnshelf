import {
	type GenreDiscovery,
	moviesControllerDiscoverMoviesOptions,
	showsControllerDiscoverShowsOptions,
} from "@opnshelf/api";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import ActionableMediaCard from "#/components/ActionableMediaCard";
import { Pagination } from "#/components/Pagination";
import { PosterGridSkeleton } from "#/components/skeletons";
import { ShowProgressScope } from "#/lib/hooks/useShowProgress";
import { getPosterUrl, getTitle, toUnifiedResult } from "#/lib/search-results";

export function GenreDiscover({
	filter,
	page,
}: {
	filter: GenreDiscovery;
	page: number;
}) {
	const navigate = useNavigate();
	const movies = useQuery({
		...moviesControllerDiscoverMoviesOptions({
			query: { genreId: filter.genre, page },
		}),
		enabled: filter.type === "movies",
		placeholderData: keepPreviousData,
	});
	const shows = useQuery({
		...showsControllerDiscoverShowsOptions({
			query: { genreId: filter.genre, page },
		}),
		enabled: filter.type === "shows",
		placeholderData: keepPreviousData,
	});
	const query = filter.type === "movies" ? movies : shows;
	const items =
		query.data?.items.map((item) =>
			toUnifiedResult(item, filter.type === "movies" ? "movie" : "tv"),
		) ?? [];
	return (
		<div className="container-app py-8">
			<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
				<div>
					<p className="mb-1 text-(--foreground-muted) text-sm">Discover</p>
					<h1 className="text-display-2">
						{filter.genreName
							? `${filter.genreName} ${filter.type}`
							: `${filter.type === "movies" ? "Movies" : "Shows"} by genre`}
					</h1>
				</div>
				<Link to="/search" search={{}} className="btn btn-secondary">
					Clear genre
				</Link>
			</div>
			{query.isError ? (
				<div role="alert" className="mb-4 flex items-center gap-3">
					<p>Couldn’t load {filter.type}. Try again.</p>
					<button
						type="button"
						className="btn btn-secondary"
						onClick={() => void query.refetch()}
					>
						Try again
					</button>
				</div>
			) : null}
			{query.isPending ? (
				<PosterGridSkeleton
					count={12}
					gridClassName="grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
				/>
			) : items.length === 0 && !query.isError ? (
				<p className="py-16 text-center text-(--foreground-muted)">
					No {filter.type} found in this genre.
				</p>
			) : (
				<ShowProgressScope
					showIds={filter.type === "shows" ? items.map((item) => item.id) : []}
				>
					<div
						className={`grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 ${query.isFetching ? "opacity-60" : ""}`}
					>
						{items.map((item) => (
							<ActionableMediaCard
								key={item.id}
								id={item.id}
								title={getTitle(item)}
								posterUrl={getPosterUrl(item)}
								type={filter.type === "movies" ? "movie" : "show"}
								tmdbRating={item.vote_average || undefined}
								layout="poster"
								fill
							/>
						))}
					</div>
				</ShowProgressScope>
			)}
			{query.data && (
				<div className="mt-6">
					<Pagination
						page={page}
						totalPages={query.data.totalPages}
						onPageChange={(next) =>
							void navigate({
								to: "/search",
								search: { ...filter, page: next },
							})
						}
					/>
				</div>
			)}
		</div>
	);
}
