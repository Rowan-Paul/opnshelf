import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authControllerMeOptions, moviesControllerGetUserMoviesOptions, moviesControllerSearchMoviesOptions, moviesControllerMarkWatchedMutation, moviesControllerUnmarkWatchedMutation } from '@opnshelf/api';
import { Search, Check, Plus } from 'lucide-react';

export const Route = createFileRoute('/search')({
  component: SearchPage,
  validateSearch: (search: Record<string, unknown>) => ({
    q: (search.q as string) || '',
  }),
});

const DEBOUNCE_MS = 300;

function SearchPage() {
  const { q: searchQuery } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const [query, setQuery] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch auth state using generated TanStack Query hook
  const { data: user } = useQuery({
    ...authControllerMeOptions(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Fetch user's tracked movies when logged in using generated TanStack Query hook
  const { data: trackedMovies } = useQuery({
    ...moviesControllerGetUserMoviesOptions({
      path: { userDid: user?.did || '' },
    }),
    enabled: !!user?.did,
  });

  // Build a set of watched movie IDs for fast lookup
  const watchedMovieIds = useMemo(() => {
    if (!trackedMovies) return new Set<string>();
    return new Set(trackedMovies.map((m: { movieId: string }) => m.movieId));
  }, [trackedMovies]);

  // Mutation for marking as watched using generated TanStack Query hook
  const markMutation = useMutation({
    ...moviesControllerMarkWatchedMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shelf'] });
    },
  });

  // Mutation for unmarking as watched using generated TanStack Query hook
  const unmarkMutation = useMutation({
    ...moviesControllerUnmarkWatchedMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shelf'] });
    },
  });

  // Sync input with URL when navigating back/forward
  useEffect(() => {
    setQuery(searchQuery);
  }, [searchQuery]);

  // Debounced navigation when query changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = query.trim();
    if (trimmed !== searchQuery) {
      debounceRef.current = setTimeout(() => {
        navigate({ search: { q: trimmed } });
      }, DEBOUNCE_MS);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, searchQuery, navigate]);

  // Search movies using generated TanStack Query hook
  const { data, isLoading, error } = useQuery({
    ...moviesControllerSearchMoviesOptions({
      query: { query: searchQuery },
    }),
    enabled: searchQuery.length > 0,
  });

  const isPending = markMutation.isPending || unmarkMutation.isPending;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <h1 className="text-4xl font-bold mb-8">Search Movies</h1>
        
        <div className="mb-8">
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a movie..."
              className="w-full pl-12 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-gray-50 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-900 text-red-400 px-4 py-3 rounded-lg">
            Error: {error.message}
          </div>
        )}

        {data && data.results.length > 0 && (
          <div>
            <p className="text-gray-400 mb-6">
              Found {data.total_results.toLocaleString()} results
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {data.results.map((movie) => {
                const movieId = movie.id.toString();
                const isWatched = watchedMovieIds.has(movieId);

                return (
                  <div
                    key={movie.id}
                    className="group"
                  >
                    <div className="relative aspect-2/3 bg-gray-900 rounded-lg overflow-hidden mb-2">
                      {movie.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                          alt={movie.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                          No poster
                        </div>
                      )}
                      {user && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isWatched) {
                              unmarkMutation.mutate({ path: { movieId } });
                            } else {
                              markMutation.mutate({ body: { movieId } });
                            }
                          }}
                          disabled={isPending}
                          className={`absolute top-2 right-2 p-2 rounded-full transition-opacity disabled:opacity-50 ${
                            isWatched
                              ? 'bg-green-600 hover:bg-red-600 opacity-100'
                              : 'bg-purple-600 hover:bg-purple-700 opacity-0 group-hover:opacity-100'
                          }`}
                          title={isWatched ? 'Remove from shelf' : 'Mark as watched'}
                        >
                          {isWatched ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm line-clamp-2 mb-1">
                      {movie.title}
                    </h3>
                    {movie.release_date && (
                      <p className="text-gray-500 text-sm">
                        {movie.release_date.split('-')[0]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {data && data.results.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No results found for "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
