import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  authControllerMeOptions,
  moviesControllerGetUserMoviesOptions,
  moviesControllerGetUserMoviesQueryKey,
  moviesControllerSearchMoviesOptions,
  moviesControllerMarkWatchedMutation,
  moviesControllerUnmarkWatchedMutation,
} from '@opnshelf/api';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RootStackParamList } from '../navigation';
import { useNumColumns } from '../utils';
import { Skeleton } from '@/components/ui/skeleton';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

const DEBOUNCE_MS = 300;
const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';

type MovieItem = {
  id: number;
  title: string;
  poster_path?: string;
  release_date?: string;
};

function MovieCard({
  movie,
  isWatched,
  onMarkWatched,
  onUnmarkWatched,
  isLoading,
  onPress,
  cardWidth,
}: {
  movie: MovieItem;
  isWatched: boolean;
  onMarkWatched: () => void;
  onUnmarkWatched: () => void;
  isLoading: boolean;
  onPress: () => void;
  cardWidth: number;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ width: cardWidth }}
      activeOpacity={0.8}
    >
      <View className="aspect-2/3 bg-gray-900 rounded-lg overflow-hidden mb-2 relative">
        {movie.poster_path ? (
          <Image
            source={{ uri: `${POSTER_BASE}${movie.poster_path}` }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="flex-1 justify-center items-center">
            <Text className="text-gray-500 text-xs">No poster</Text>
          </View>
        )}
        {/* Watch status button - stop propagation to prevent navigation when clicking this */}
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            if (isWatched) {
              onUnmarkWatched();
            } else {
              onMarkWatched();
            }
          }}
          disabled={isLoading}
          className={`absolute top-2 right-2 p-2 rounded-full ${
            isWatched ? 'bg-green-600' : 'bg-violet-600'
          }`}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : isWatched ? (
            <Ionicons name="checkmark" size={16} color="#fff" />
          ) : (
            <Ionicons name="add" size={16} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
      <Text className="text-sm font-semibold text-gray-50 mb-1" numberOfLines={2}>
        {movie.title}
      </Text>
      {movie.release_date ? (
        <Text className="text-xs text-gray-500">
          {movie.release_date.split('-')[0]}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

export function SearchScreen({ route, navigation }: Props) {
  const queryClient = useQueryClient();
  const initialQ = route.params?.q ?? '';
  const [query, setQuery] = useState(initialQ);
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { width } = useWindowDimensions();
  const numColumns = useNumColumns('search');
  const flatListKey = `search-grid-${numColumns}-${width}`;
  
  // Calculate card width: (screen width - padding - gaps) / numColumns
  const cardWidth = (width - 32 - (numColumns - 1) * 16) / numColumns;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed !== searchQuery) {
      debounceRef.current = setTimeout(
        () => setSearchQuery(trimmed),
        DEBOUNCE_MS,
      );
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchQuery]);

  // Auth state using generated TanStack Query hook
  const { data: user } = useQuery({
    ...authControllerMeOptions(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // User's tracked movies using generated TanStack Query hook
  const { data: trackedMovies } = useQuery({
    ...moviesControllerGetUserMoviesOptions({
      path: { userDid: user?.did || '' },
    }),
    enabled: !!user?.did,
  });

  // Create a set of watched movie IDs for quick lookup
  const watchedMovieIds = new Set(
    trackedMovies?.map((t: { movieId: string }) => t.movieId) ?? [],
  );

  // Mutations for marking/unmarking movies using generated TanStack Query hooks
  const markMutation = useMutation({
    ...moviesControllerMarkWatchedMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: moviesControllerGetUserMoviesQueryKey({
          path: { userDid: user?.did || '' },
        }),
      });
    },
  });

  const unmarkMutation = useMutation({
    ...moviesControllerUnmarkWatchedMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: moviesControllerGetUserMoviesQueryKey({
          path: { userDid: user?.did || '' },
        }),
      });
    },
  });

  // Search movies using generated TanStack Query hook
  const { data, isLoading, error } = useQuery({
    ...moviesControllerSearchMoviesOptions({
      query: { query: searchQuery },
    }),
    enabled: searchQuery.length > 0,
  });

  const results = data?.results ?? [];
  const totalResults = data?.total_results ?? 0;

  const handleMarkWatched = useCallback(
    (movieId: string) => {
      if (!user) {
        navigation.navigate('Login', { redirect: 'Search' });
        return;
      }
      markMutation.mutate({ body: { movieId } });
    },
    [user, navigation, markMutation],
  );

  const handleUnmarkWatched = useCallback(
    (movieId: string) => {
      unmarkMutation.mutate({ path: { movieId } });
    },
    [unmarkMutation],
  );

  const handleNavigateToDetail = useCallback(
    (movie: MovieItem) => {
      navigation.navigate('MovieDetail', {
        movieId: String(movie.id),
        title: movie.title,
      });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: MovieItem }) => {
      const movieId = String(item.id);
      const isWatched = watchedMovieIds.has(movieId);
      const isLoading =
        (markMutation.isPending && markMutation.variables?.body?.movieId === movieId) ||
        (unmarkMutation.isPending && unmarkMutation.variables?.path?.movieId === movieId);

      return (
        <MovieCard
          movie={item}
          isWatched={isWatched}
          onMarkWatched={() => handleMarkWatched(movieId)}
          onUnmarkWatched={() => handleUnmarkWatched(movieId)}
          isLoading={isLoading}
          onPress={() => handleNavigateToDetail(item)}
          cardWidth={cardWidth}
        />
      );
    },
    [watchedMovieIds, markMutation, unmarkMutation, handleMarkWatched, handleUnmarkWatched, handleNavigateToDetail, cardWidth],
  );

  const keyExtractor = useCallback((item: MovieItem) => String(item.id), []);

  return (
    <View className="flex-1 bg-gray-950 px-4 pt-12 pb-6">
      <Text className="text-3xl font-bold text-gray-50 mb-6">
        Search Movies
      </Text>

      <View className="flex-row items-center bg-gray-900 border border-gray-800 rounded-lg mb-6">
        <View className="ml-4">
          <Ionicons name="search" size={20} color="#9ca3af" />
        </View>
        <TextInput
          className="flex-1 py-3 px-3 pl-2 text-base text-gray-50"
          value={query}
          onChangeText={setQuery}
          placeholder="Search for a movie..."
          placeholderTextColorClassName="accent-gray-500"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {isLoading && (
        <View className="flex-1">
          <FlatList
            data={[...Array(numColumns * 3)]}
            renderItem={() => (
              <View style={{ width: cardWidth }}>
                <Skeleton className="aspect-2/3 rounded-lg mb-2" />
                <Skeleton className="h-4 w-3/4 mb-1" />
                <Skeleton className="h-3 w-1/2" />
              </View>
            )}
            keyExtractor={(_, index) => `search-skeleton-${index}`}
            numColumns={numColumns}
            columnWrapperClassName="gap-4 mb-4"
            contentContainerClassName="pb-6"
          />
        </View>
      )}

      {error && (
        <View className="bg-red-950/20 border border-red-900/50 rounded-lg p-3 mb-6">
          <Text className="text-red-400">
            Error: {(error as Error).message}
          </Text>
        </View>
      )}

      {data && results.length > 0 && (
        <>
          <Text className="text-gray-400 mb-4">
            Found {totalResults.toLocaleString()} results
          </Text>
          <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            numColumns={numColumns}
            columnWrapperClassName="gap-4 mb-4"
            contentContainerClassName="pb-6"
            key={flatListKey}
          />
        </>
      )}

      {data && results.length === 0 && searchQuery.length > 0 && (
        <View className="flex-1 justify-center py-12">
          <Text className="text-gray-400 text-lg text-center">
            No results found for &quot;{searchQuery}&quot;
          </Text>
        </View>
      )}
    </View>
  );
}
