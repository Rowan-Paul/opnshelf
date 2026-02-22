import {
	authControllerMeOptions,
	moviesControllerGetUserMoviesOptions,
	searchControllerDiscoverAllOptions,
	searchControllerSearchAllOptions,
	showsControllerGetUserShowsOptions,
	type TmdbMovieResultDto,
	type UnifiedSearchResultDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MovieCard } from "@/components/MovieCard";
import { ShowCard } from "@/components/ShowCard";
import { M3TextField } from "@/components/ui/m3-text-field";

export const Route = createFileRoute("/search")({
	component: SearchPage,
	validateSearch: (search: Record<string, unknown>) => ({
		q: (search.q as string) || "",
		type: (search.type as "all" | "movies" | "shows") || "all",
	}),
	head: () => ({
		meta: [{ title: "Search Movies & Shows | OpnShelf" }],
	}),
});

const DEBOUNCE_MS = 300;

function SearchPage() {
	const { q: searchQuery, type } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const [query, setQuery] = useState(searchQuery);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastNavigatedQueryRef = useRef<string>(searchQuery);

	const { data: user } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	const { data: trackedMovies } = useQuery({
		...moviesControllerGetUserMoviesOptions({
			path: { userDid: user?.did || "" },
		}),
		enabled: !!user?.did,
	});

	const { data: trackedShows } = useQuery({
		...showsControllerGetUserShowsOptions({
			path: { userDid: user?.did || "" },
		}),
		enabled: !!user?.did,
	});

	const watchedMovieIds = useMemo(() => {
		if (!trackedMovies) return new Set<string>();
		return new Set(trackedMovies.map((m: { movieId: string }) => m.movieId));
	}, [trackedMovies]);

	const watchedShowIds = useMemo(() => {
		if (!trackedShows) return new Set<string>();
		return new Set(trackedShows.map((s: { showId: string }) => s.showId));
	}, [trackedShows]);

	useEffect(() => {
		if (searchQuery !== lastNavigatedQueryRef.current) {
			setQuery(searchQuery);
			lastNavigatedQueryRef.current = searchQuery;
		}
	}, [searchQuery]);

	useEffect(() => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		const trimmed = query.trim();
		if (trimmed !== searchQuery) {
			debounceRef.current = setTimeout(() => {
				lastNavigatedQueryRef.current = trimmed;
				navigate({
					search: { q: trimmed, type },
					replace: true,
					resetScroll: false,
				});
			}, DEBOUNCE_MS);
		}

		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, [query, searchQuery, type, navigate]);

	const hasQuery = searchQuery.length > 0;
	const isMovies = type === "movies";
	const isShows = type === "shows";

	const {
		data: searchData,
		isLoading: isSearchLoading,
		error: searchError,
	} = useQuery({
		...searchControllerSearchAllOptions({
			query: { query: searchQuery },
		}),
		enabled: hasQuery,
	});

	const { data: discoverData, isLoading: isDiscoverLoading } = useQuery({
		...searchControllerDiscoverAllOptions({}),
		enabled: !hasQuery,
	});

	const results: UnifiedSearchResultDto[] = hasQuery
		? (searchData?.results ?? [])
		: (discoverData?.results ?? []);

	const total = hasQuery
		? (searchData?.total_results ?? results.length)
		: results.length;

	const showTotal = hasQuery && total > 0;

	const loading = hasQuery ? isSearchLoading : isDiscoverLoading;

	const switchType = (nextType: "all" | "movies" | "shows") => {
		const trimmed = query.trim();
		lastNavigatedQueryRef.current = trimmed;
		navigate({
			search: { q: trimmed, type: nextType },
			replace: true,
			resetScroll: false,
		});
	};

	const movieResults = useMemo(() => {
		if (isShows) return [];
		return results.filter((r) => r.media_type === "movie");
	}, [results, isShows]);

	const showResults = useMemo(() => {
		if (isMovies) return [];
		return results.filter((r) => r.media_type === "tv");
	}, [results, isMovies]);

	const combinedResults = useMemo(() => {
		if (isMovies) return movieResults;
		if (isShows) return showResults;
		return results;
	}, [isMovies, isShows, movieResults, showResults, results]);

	return (
		<div
			className="min-h-screen"
			style={{
				backgroundColor: "var(--md-sys-color-background)",
				color: "var(--md-sys-color-on-background)",
			}}
		>
			<div className="container mx-auto px-4 py-4 max-w-7xl">
				<h1 className="md-display-small mb-8">Search Movies & Shows</h1>

				<div className="mb-8">
					<div className="relative max-w-2xl">
						<M3TextField
							type="text"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search movies and shows..."
							variant="outlined"
							leadingIcon={<Search className="w-5 h-5" />}
						/>
						{query && (
							<button
								type="button"
								onClick={() => {
									setQuery("");
									lastNavigatedQueryRef.current = "";
									navigate({
										search: { q: "", type },
										replace: true,
										resetScroll: false,
									});
								}}
								className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors hover:bg-(--md-sys-color-on-surface)/10"
								style={{ color: "var(--md-sys-color-on-surface-variant)" }}
							>
								<X className="w-4 h-4" />
							</button>
						)}
					</div>
					<div className="mt-4 inline-flex rounded-full p-1 bg-(--md-sys-color-surface-container-high)">
						{(["all", "movies", "shows"] as const).map((tab) => (
							<button
								key={tab}
								type="button"
								onClick={() => switchType(tab)}
								className="px-4 py-2 rounded-full text-sm capitalize transition-colors"
								style={{
									backgroundColor:
										type === tab
											? "var(--md-sys-color-primary)"
											: "transparent",
									color:
										type === tab
											? "var(--md-sys-color-on-primary)"
											: "var(--md-sys-color-on-surface)",
								}}
							>
								{tab}
							</button>
						))}
					</div>
				</div>

				{searchError && (
					<div
						className="max-w-2xl p-4 rounded-lg mb-4"
						style={{
							backgroundColor: "var(--md-sys-color-error-container)",
							border: "1px solid var(--md-sys-color-error)",
						}}
					>
						<p style={{ color: "var(--md-sys-color-on-error-container)" }}>
							Error: {(searchError as Error).message}
						</p>
					</div>
				)}

				{loading ? (
					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
						{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
							<div
								key={i}
								className="aspect-2/3 bg-gray-800 rounded-lg animate-pulse"
							/>
						))}
					</div>
				) : combinedResults.length > 0 ? (
					<>
						<div className="flex items-center justify-between mb-4">
							<h2 className="md-title-large">
								{hasQuery ? "Results" : "Popular"}
							</h2>
							{showTotal && (
								<span className="text-sm text-(--md-sys-color-on-surface-variant)">
									{total.toLocaleString()} results
								</span>
							)}
						</div>
						<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
							{combinedResults.map((item) => {
								if (item.media_type === "movie") {
									const movie: TmdbMovieResultDto = {
										id: item.id,
										title: item.title ?? "",
										poster_path: item.poster_path,
										backdrop_path: item.backdrop_path,
										release_date: item.release_date,
										overview: item.overview,
									};
									return (
										<MovieCard
											key={`movie-${item.id}`}
											movie={movie}
											user={user}
											isWatched={watchedMovieIds.has(item.id.toString())}
										/>
									);
								} else {
									const show = {
										id: item.id,
										name: item.name ?? "",
										poster_path: item.poster_path,
										backdrop_path: item.backdrop_path,
										first_air_date: item.first_air_date,
										overview: item.overview,
									};
									return (
										<ShowCard
											key={`show-${item.id}`}
											show={show}
											user={user}
											isWatched={watchedShowIds.has(item.id.toString())}
										/>
									);
								}
							})}
						</div>
					</>
				) : (
					<div className="text-center py-12 text-(--md-sys-color-on-surface-variant)">
						{hasQuery
							? `No results found for "${searchQuery}"`
							: "No popular content available"}
					</div>
				)}
			</div>
		</div>
	);
}
