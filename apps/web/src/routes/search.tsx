import {
	authControllerMeOptions,
	moviesControllerDiscoverMoviesOptions,
	moviesControllerGetUserMoviesOptions,
	moviesControllerSearchMoviesOptions,
	showsControllerDiscoverShowsOptions,
	showsControllerSearchShowsOptions,
	type TmdbMovieResultDto,
	type TmdbShowResultDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MovieGrid, MovieGridSkeleton } from "@/components/MovieGrid";
import { ShowGrid } from "@/components/ShowGrid";
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
const ALL_PREVIEW_LIMIT = 12;

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

	const watchedMovieIds = useMemo(() => {
		if (!trackedMovies) return new Set<string>();
		return new Set(trackedMovies.map((m: { movieId: string }) => m.movieId));
	}, [trackedMovies]);

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
	const isAll = type === "all";
	const isMovies = type === "movies";
	const isShows = type === "shows";

	const {
		data: movieSearchData,
		isLoading: isMovieSearchLoading,
		error: movieSearchError,
	} = useQuery({
		...moviesControllerSearchMoviesOptions({
			query: { query: searchQuery },
		}),
		enabled: hasQuery && (isAll || isMovies),
	});

	const {
		data: showSearchData,
		isLoading: isShowSearchLoading,
		error: showSearchError,
	} = useQuery({
		...showsControllerSearchShowsOptions({
			query: { query: searchQuery },
		}),
		enabled: hasQuery && (isAll || isShows),
	});

	const { data: discoverMoviesData, isLoading: isDiscoverMoviesLoading } =
		useQuery({
			...moviesControllerDiscoverMoviesOptions({}),
			enabled: !hasQuery && (isAll || isMovies),
		});

	const { data: discoverShowsData, isLoading: isDiscoverShowsLoading } =
		useQuery({
			...showsControllerDiscoverShowsOptions({}),
			enabled: !hasQuery && (isAll || isShows),
		});

	const movieResults: TmdbMovieResultDto[] = hasQuery
		? (movieSearchData?.results ?? [])
		: (discoverMoviesData?.results ?? []);
	const showResults: TmdbShowResultDto[] = hasQuery
		? (showSearchData?.results ?? [])
		: (discoverShowsData?.results ?? []);

	const movieTotal = hasQuery
		? (movieSearchData?.total_results ?? movieResults.length)
		: movieResults.length;
	const showTotal = hasQuery
		? (showSearchData?.total_results ?? showResults.length)
		: showResults.length;

	const movieLoading = hasQuery
		? isMovieSearchLoading
		: isDiscoverMoviesLoading;
	const showLoading = hasQuery ? isShowSearchLoading : isDiscoverShowsLoading;
	const primaryError = movieSearchError || showSearchError;

	const switchType = (nextType: "all" | "movies" | "shows") => {
		const trimmed = query.trim();
		lastNavigatedQueryRef.current = trimmed;
		navigate({
			search: { q: trimmed, type: nextType },
			replace: true,
			resetScroll: false,
		});
	};

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
								className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors hover:bg-[var(--md-sys-color-on-surface)]/10"
								style={{ color: "var(--md-sys-color-on-surface-variant)" }}
							>
								<X className="w-4 h-4" />
							</button>
						)}
					</div>
					<div className="mt-4 inline-flex rounded-full p-1 bg-[var(--md-sys-color-surface-container-high)]">
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

				{primaryError && (
					<div
						className="max-w-2xl p-4 rounded-lg mb-4"
						style={{
							backgroundColor: "var(--md-sys-color-error-container)",
							border: "1px solid var(--md-sys-color-error)",
						}}
					>
						<p style={{ color: "var(--md-sys-color-on-error-container)" }}>
							Error: {primaryError.message}
						</p>
					</div>
				)}

				{isAll && (
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
						<section>
							<div className="flex items-center justify-between mb-4">
								<h2 className="md-title-large">Movies</h2>
								<span className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
									{movieTotal.toLocaleString()}
								</span>
							</div>
							{movieLoading ? (
								<MovieGridSkeleton count={6} />
							) : movieResults.length > 0 ? (
								<MovieGrid
									movies={movieResults.slice(0, ALL_PREVIEW_LIMIT)}
									user={user}
									watchedMovieIds={watchedMovieIds}
									gridClassName="grid-cols-2 md:grid-cols-3"
								/>
							) : (
								<p className="text-sm text-[var(--md-sys-color-on-surface-variant)] py-4">
									No movie results.
								</p>
							)}
						</section>

						<section>
							<div className="flex items-center justify-between mb-4">
								<h2 className="md-title-large">Shows</h2>
								<span className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
									{showTotal.toLocaleString()}
								</span>
							</div>
							{showLoading ? (
								<MovieGridSkeleton count={6} />
							) : showResults.length > 0 ? (
								<ShowGrid
									shows={showResults.slice(0, ALL_PREVIEW_LIMIT)}
									gridClassName="grid-cols-2 md:grid-cols-3"
								/>
							) : (
								<p className="text-sm text-[var(--md-sys-color-on-surface-variant)] py-4">
									No show results.
								</p>
							)}
						</section>
					</div>
				)}

				{isMovies && (
					<section>
						<div className="flex items-center justify-between mb-4">
							<h2 className="md-title-large">
								{hasQuery ? "Movie Results" : "Popular Movies"}
							</h2>
							<span className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
								{movieTotal.toLocaleString()}
							</span>
						</div>
						{movieLoading ? (
							<MovieGridSkeleton />
						) : movieResults.length > 0 ? (
							<MovieGrid
								movies={movieResults}
								user={user}
								watchedMovieIds={watchedMovieIds}
							/>
						) : (
							<div className="text-center py-12 text-[var(--md-sys-color-on-surface-variant)]">
								No movie results found for &quot;{searchQuery}&quot;
							</div>
						)}
					</section>
				)}

				{isShows && (
					<section>
						<div className="flex items-center justify-between mb-4">
							<h2 className="md-title-large">
								{hasQuery ? "Show Results" : "Popular Shows"}
							</h2>
							<span className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
								{showTotal.toLocaleString()}
							</span>
						</div>
						{showLoading ? (
							<MovieGridSkeleton />
						) : showResults.length > 0 ? (
							<ShowGrid shows={showResults} />
						) : (
							<div className="text-center py-12 text-[var(--md-sys-color-on-surface-variant)]">
								No show results found for &quot;{searchQuery}&quot;
							</div>
						)}
					</section>
				)}
			</div>
		</div>
	);
}
