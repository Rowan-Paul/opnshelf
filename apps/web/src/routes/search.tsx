import {
	authControllerMeOptions,
	moviesControllerDiscoverMoviesOptions,
	moviesControllerGetUserMoviesOptions,
	moviesControllerSearchMoviesOptions,
	type TmdbMovieResultDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MovieGrid, MovieGridSkeleton } from "@/components/MovieGrid";
import { M3TextField } from "@/components/ui/m3-text-field";

export const Route = createFileRoute("/search")({
	component: SearchPage,
	validateSearch: (search: Record<string, unknown>) => ({
		q: (search.q as string) || "",
	}),
	head: () => ({
		meta: [{ title: "Search Movies | OpnShelf" }],
	}),
});

const DEBOUNCE_MS = 300;

function SearchPage() {
	const { q: searchQuery } = Route.useSearch();
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
				navigate({ search: { q: trimmed } });
			}, DEBOUNCE_MS);
		}

		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, [query, searchQuery, navigate]);

	const { data, isLoading, error } = useQuery({
		...moviesControllerSearchMoviesOptions({
			query: { query: searchQuery },
		}),
		enabled: searchQuery.length > 0,
	});

	const { data: discoverData, isLoading: isDiscoverLoading } = useQuery({
		...moviesControllerDiscoverMoviesOptions({}),
		enabled: searchQuery.length === 0,
	});

	const searchResults: TmdbMovieResultDto[] = data?.results || [];
	const discoverResults: TmdbMovieResultDto[] = discoverData?.results || [];

	return (
		<div
			className="min-h-screen"
			style={{
				backgroundColor: "var(--md-sys-color-background)",
				color: "var(--md-sys-color-on-background)",
			}}
		>
			<div className="container mx-auto px-4 py-4 max-w-7xl">
				<h1 className="md-display-small mb-8">Search Movies</h1>

				<div className="mb-8">
					<div className="relative max-w-2xl">
						<M3TextField
							type="text"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search for a movie..."
							variant="outlined"
							leadingIcon={<Search className="w-5 h-5" />}
						/>
						{query && (
							<button
								type="button"
								onClick={() => {
									setQuery("");
									lastNavigatedQueryRef.current = "";
									navigate({ search: { q: "" } });
								}}
								className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors hover:bg-[var(--md-sys-color-on-surface)]/10"
								style={{ color: "var(--md-sys-color-on-surface-variant)" }}
							>
								<X className="w-4 h-4" />
							</button>
						)}
					</div>
				</div>

				{isLoading && <MovieGridSkeleton />}

				{error && (
					<div
						className="max-w-2xl p-4 rounded-lg mb-4"
						style={{
							backgroundColor: "var(--md-sys-color-error-container)",
							border: "1px solid var(--md-sys-color-error)",
						}}
					>
						<p style={{ color: "var(--md-sys-color-on-error-container)" }}>
							Error: {error.message}
						</p>
					</div>
				)}

				{data && searchResults.length > 0 && (
					<div>
						<p
							className="mb-6 md-body-large"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							Found {data.total_results.toLocaleString()} results
						</p>
						<MovieGrid
							movies={searchResults}
							user={user}
							watchedMovieIds={watchedMovieIds}
						/>
					</div>
				)}

				{data && searchResults.length === 0 && searchQuery && (
					<div className="text-center py-12">
						<p
							className="md-body-large"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							No results found for &quot;{searchQuery}&quot;
						</p>
					</div>
				)}

				{!searchQuery && (
					<div>
						<h2
							className="md-title-large mb-4"
							style={{ color: "var(--md-sys-color-on-surface)" }}
						>
							Popular Movies
						</h2>
						{isDiscoverLoading && <MovieGridSkeleton />}
						{discoverData && discoverResults.length > 0 && (
							<MovieGrid
								movies={discoverResults}
								user={user}
								watchedMovieIds={watchedMovieIds}
							/>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
