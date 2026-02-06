import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authControllerMeOptions, moviesControllerGetUserMoviesOptions, moviesControllerUnmarkWatchedMutation } from '@opnshelf/api';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCallback } from 'react';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Shelf'>;

const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';

type TrackedMovie = {
  id: string;
  movieId: string;
  watchedDate?: string;
  movie: {
    title: string;
    posterPath?: string;
    releaseYear?: number;
  };
};

function MovieCard({
  tracked,
  onRemove,
  isRemoving,
  onPress,
}: {
  tracked: TrackedMovie;
  onRemove: () => void;
  isRemoving: boolean;
  onPress: () => void;
}) {
  // Format watched date
  const formattedWatchedDate = tracked.watchedDate
    ? new Date(tracked.watchedDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row bg-gray-900/50 rounded-lg overflow-hidden border border-gray-800/50"
      activeOpacity={0.8}
    >
      {/* Poster thumbnail - smaller for mobile list */}
      <View className="w-20 aspect-2/3 bg-gray-900">
        {tracked.movie.posterPath ? (
          <Image
            source={{ uri: `${POSTER_BASE}${tracked.movie.posterPath}` }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="flex-1 justify-center items-center">
            <Text className="text-gray-600 text-xs">No poster</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View className="flex-1 p-3 justify-between">
        <View>
          <Text className="text-base font-semibold text-gray-50 mb-1" numberOfLines={2}>
            {tracked.movie.title}
          </Text>
          <View className="flex-row items-center gap-2">
            {tracked.movie.releaseYear && (
              <Text className="text-sm text-gray-400">{tracked.movie.releaseYear}</Text>
            )}
            {formattedWatchedDate && (
              <>
                <Text className="text-gray-600">•</Text>
                <View className="flex-row items-center">
                  <Ionicons name="checkmark-circle" size={12} color="#22c55e" />
                  <Text className="text-sm text-green-500 ml-1">{formattedWatchedDate}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Remove button */}
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            disabled={isRemoving}
            className="flex-row items-center gap-1 px-3 py-1.5 bg-red-600/90 rounded-full"
            activeOpacity={0.7}
          >
            {isRemoving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={14} color="#fff" />
                <Text className="text-white text-sm font-medium">Remove</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function ShelfScreen({ navigation }: Props) {
  const queryClient = useQueryClient();

  // Fetch auth state using generated TanStack Query hook
  const { data: user, isLoading: isAuthLoading } = useQuery({
    ...authControllerMeOptions(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Fetch user's tracked movies using generated TanStack Query hook
  const { data: trackedMovies, isLoading: isMoviesLoading } = useQuery({
    ...moviesControllerGetUserMoviesOptions({
      path: { userDid: user?.did || '' },
    }),
    enabled: !!user?.did,
  });

  // Mutation for removing from shelf using generated TanStack Query hook
  const unmarkMutation = useMutation({
    ...moviesControllerUnmarkWatchedMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shelf'] });
    },
  });

  const handleNavigateToDetail = useCallback(
    (tracked: TrackedMovie) => {
      navigation.navigate('MovieDetail', {
        movieId: tracked.movieId,
        title: tracked.movie.title,
      });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: TrackedMovie }) => (
      <MovieCard
        tracked={item}
        onRemove={() => unmarkMutation.mutate({ path: { movieId: item.movieId } })}
        isRemoving={unmarkMutation.isPending && unmarkMutation.variables?.path?.movieId === item.movieId}
        onPress={() => handleNavigateToDetail(item)}
      />
    ),
    [unmarkMutation, handleNavigateToDetail],
  );

  const keyExtractor = useCallback((item: TrackedMovie) => item.id, []);

  if (isAuthLoading) {
    return (
      <View className="flex-1 bg-gray-950 justify-center items-center">
        <ActivityIndicator size="large" colorClassName="accent-violet-500" />
      </View>
    );
  }

  if (!user) {
    return (
      <View className="flex-1 bg-gray-950 px-4 pt-12 pb-6">
        <View className="flex-1 justify-center items-center">
          <Ionicons name="book" size={64} color="#a855f7" />
          <Text className="text-3xl font-bold text-gray-50 mt-6 mb-4">
            My Shelf
          </Text>
          <Text className="text-lg text-gray-400 text-center mb-8">
            Sign in to track movies you've watched
          </Text>
          <TouchableOpacity
            className="flex-row items-center gap-2 bg-violet-600 py-3 px-6 rounded-lg"
            onPress={() => navigation.navigate('Login', { redirect: 'Shelf' })}
            activeOpacity={0.8}
          >
            <Ionicons name="log-in" size={20} color="#fff" />
            <Text className="text-white font-semibold">Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-950 px-4 pt-12 pb-6">
      <View className="flex-row items-center gap-3 mb-8">
        <Ionicons name="book" size={32} color="#a855f7" />
        <Text className="text-3xl font-bold text-gray-50">My Shelf</Text>
      </View>

      {isMoviesLoading && (
        <View className="flex-1 justify-center py-12">
          <ActivityIndicator size="large" colorClassName="accent-violet-500" />
        </View>
      )}

      {trackedMovies && trackedMovies.length > 0 && (
        <>
          <Text className="text-gray-400 mb-4">
            {trackedMovies.length} movie{trackedMovies.length !== 1 ? 's' : ''}{' '}
            watched
          </Text>
          <FlatList
            data={trackedMovies as TrackedMovie[]}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerClassName="pb-6 gap-3"
            key="list"
          />
        </>
      )}

      {trackedMovies && trackedMovies.length === 0 && (
        <View className="flex-1 justify-center items-center py-12">
          <Ionicons name="book" size={64} color="#374151" />
          <Text className="text-gray-400 text-lg mt-4 mb-6">
            Your shelf is empty
          </Text>
          <TouchableOpacity
            className="flex-row items-center gap-2 bg-violet-600 py-3 px-6 rounded-lg"
            onPress={() => navigation.navigate('Search', {})}
            activeOpacity={0.8}
          >
            <Ionicons name="search" size={20} color="#fff" />
            <Text className="text-white font-semibold">Search for movies</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
