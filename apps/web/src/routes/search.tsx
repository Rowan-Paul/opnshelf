import {
	authControllerMeOptions,
	moviesControllerDiscoverMoviesOptions,
	moviesControllerGetUserMoviesOptions,
	moviesControllerSearchMoviesOptions,
	type TmdbMovieResultDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MovieGrid, MovieGridSkeleton } from "@/components/MovieGrid";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

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
		<div className="min-h-screen bg-gray-950 text-gray-50">
			<div className="container mx-auto px-4 py-4 max-w-7xl">
				<h1 className="text-4xl font-bold mb-8">Search Movies</h1>

				<div className="mb-8">
					<div className="relative max-w-2xl">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
						<Input
							type="text"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search for a movie..."
							className="w-full pl-10 bg-gray-900 border-gray-800 text-gray-50 placeholder:text-gray-500 focus-visible:ring-purple-500"
						/>
					</div>
				</div>

				{isLoading && <MovieGridSkeleton />}

				{error && (
					<Alert variant="destructive" className="max-w-2xl">
						<AlertDescription>Error: {error.message}</AlertDescription>
					</Alert>
				)}

				{data && searchResults.length > 0 && (
					<div>
						<p className="text-gray-400 mb-6">
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
						<p className="text-gray-400 text-lg">
							No results found for &quot;{searchQuery}&quot;
						</p>
					</div>
				)}

				{!searchQuery && (
					<div>
						<h2 className="text-xl font-semibold text-gray-200 mb-4">
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
