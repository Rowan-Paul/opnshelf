import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { searchMovies } from '@opnshelf/api';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RootStackParamList } from '../navigation';
type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

const DEBOUNCE_MS = 300;
const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';

type MovieItem = {
  id: number;
  title: string;
  poster_path?: string;
  release_date?: string;
};

function MovieCard({ movie }: { movie: MovieItem }) {
  return (
    <View style={styles.movieCard}>
      <View style={styles.posterWrap}>
        {movie.poster_path ? (
          <Image
            source={{ uri: `${POSTER_BASE}${movie.poster_path}` }}
            style={styles.poster}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Text style={styles.posterPlaceholderText}>No poster</Text>
          </View>
        )}
      </View>
      <Text style={styles.movieTitle} numberOfLines={2}>
        {movie.title}
      </Text>
      {movie.release_date ? (
        <Text style={styles.movieYear}>{movie.release_date.split('-')[0]}</Text>
      ) : null}
    </View>
  );
}

export function SearchScreen({ route }: Props) {
  const initialQ = route.params?.q ?? '';
  const [query, setQuery] = useState(initialQ);
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed !== searchQuery) {
      debounceRef.current = setTimeout(() => setSearchQuery(trimmed), DEBOUNCE_MS);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchQuery]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['search', searchQuery],
    queryFn: () => searchMovies(searchQuery),
    enabled: searchQuery.length > 0,
  });

  const results = data?.results ?? [];
  const totalResults = data?.total_results ?? 0;

  const renderItem = useCallback(
    ({ item }: { item: MovieItem }) => <MovieCard movie={item} />,
    []
  );

  const keyExtractor = useCallback((item: MovieItem) => String(item.id), []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Search Movies</Text>

      <View style={styles.inputWrap}>
        <Ionicons
          name="search"
          size={20}
          color="#9ca3af"
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search for a movie..."
          placeholderTextColor="#6b7280"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {isLoading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#a855f7" />
        </View>
      )}

      {error && (
        <View style={styles.error}>
          <Text style={styles.errorText}>Error: {(error as Error).message}</Text>
        </View>
      )}

      {data && results.length > 0 && (
        <>
          <Text style={styles.resultCount}>
            Found {totalResults.toLocaleString()} results
          </Text>
          <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.listContent}
            key="grid"
          />
        </>
      )}

      {data && results.length === 0 && searchQuery.length > 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No results found for "{searchQuery}"
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 24,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    marginBottom: 24,
  },
  inputIcon: {
    marginLeft: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingLeft: 8,
    fontSize: 16,
    color: '#f9fafb',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 48,
  },
  error: {
    backgroundColor: 'rgba(127, 29, 29, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(127, 29, 29, 0.5)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  errorText: {
    color: '#f87171',
  },
  resultCount: {
    color: '#9ca3af',
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 24,
  },
  row: {
    gap: 16,
    marginBottom: 16,
  },
  movieCard: {
    flex: 1,
    maxWidth: '50%',
  },
  posterWrap: {
    aspectRatio: 2 / 3,
    backgroundColor: '#111827',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  posterPlaceholderText: {
    color: '#4b5563',
    fontSize: 12,
  },
  movieTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 4,
  },
  movieYear: {
    fontSize: 12,
    color: '#6b7280',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 18,
    textAlign: 'center',
  },
});
