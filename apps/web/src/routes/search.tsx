import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchMovies } from '@opnshelf/api';
import { Search } from 'lucide-react';

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
  const [query, setQuery] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const { data, isLoading, error } = useQuery({
    queryKey: ['search', searchQuery],
    queryFn: () => searchMovies(searchQuery),
    enabled: searchQuery.length > 0,
  });

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
              {data.results.map((movie) => (
                <div
                  key={movie.id}
                  className="group cursor-pointer"
                >
                  <div className="relative aspect-2/3 bg-gray-900 rounded-lg overflow-hidden mb-2">
                    {movie.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                        alt={movie.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600">
                        No poster
                      </div>
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
              ))}
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