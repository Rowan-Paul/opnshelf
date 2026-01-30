import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthUser, getUserMovies, unmarkMovieWatched } from '@opnshelf/api';
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
  movie: {
    title: string;
    posterPath: string | null;
    releaseYear: number | null;
  };
};

function MovieCard({
  tracked,
  onRemove,
  isRemoving,
}: {
  tracked: TrackedMovie;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  return (
    <View className="flex-1 min-w-0">
      <View className="aspect-2/3 bg-gray-900 rounded-lg overflow-hidden mb-2 relative">
        {tracked.movie.posterPath ? (
          <Image
            source={{ uri: `${POSTER_BASE}${tracked.movie.posterPath}` }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="flex-1 justify-center items-center">
            <Text className="text-gray-500 text-xs">No poster</Text>
          </View>
        )}
        <TouchableOpacity
          onPress={onRemove}
          disabled={isRemoving}
          className="absolute top-2 right-2 p-2 bg-red-600 rounded-full"
          activeOpacity={0.7}
        >
          {isRemoving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="trash" size={16} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
      <Text className="text-sm font-semibold text-gray-50 mb-1" numberOfLines={2}>
        {tracked.movie.title}
      </Text>
      {tracked.movie.releaseYear && (
        <Text className="text-xs text-gray-500">{tracked.movie.releaseYear}</Text>
      )}
    </View>
  );
}

export function ShelfScreen({ navigation }: Props) {
  const queryClient = useQueryClient();

  // Fetch auth state
  const { data: user, isLoading: isAuthLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getAuthUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Fetch user's tracked movies
  const { data: trackedMovies, isLoading: isMoviesLoading } = useQuery({
    queryKey: ['shelf', user?.did],
    queryFn: () => getUserMovies(user!.did),
    enabled: !!user?.did,
  });

  // Mutation for removing from shelf
  const unmarkMutation = useMutation({
    mutationFn: unmarkMovieWatched,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shelf'] });
    },
  });

  const renderItem = useCallback(
    ({ item }: { item: TrackedMovie }) => (
      <MovieCard
        tracked={item}
        onRemove={() => unmarkMutation.mutate(item.movieId)}
        isRemoving={unmarkMutation.isPending && unmarkMutation.variables === item.movieId}
      />
    ),
    [unmarkMutation],
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
            <Text className="text-white font-semibold">Sign in with Bluesky</Text>
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
            numColumns={2}
            columnWrapperClassName="gap-4 mb-4"
            contentContainerClassName="pb-6"
            key="grid"
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
