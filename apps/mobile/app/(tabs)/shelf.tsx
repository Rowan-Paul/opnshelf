import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  moviesControllerGetUserMoviesOptions,
  moviesControllerGetUserMoviesQueryKey,
  moviesControllerUnmarkWatchedMutation,
} from "@opnshelf/api";
import type { TrackedMovieDto } from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import {
  BookOpen,
  Loader2,
  LogIn,
  LogOut,
  Trash2,
  CheckCircle2,
} from "lucide-react-native";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/contexts/toast";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { colors, spacing, borderRadius } from "@/constants/theme";
import { Image } from "expo-image";
import { format } from "date-fns";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w342";

function createTitleSlug(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Spinning loader component
const SpinningLoader = ({ size, color }: { size: number; color: string }) => {
  const rotation = useSharedValue(0);

  rotation.value = withRepeat(
    withTiming(360, { duration: 1000, easing: Easing.linear }),
    -1,
    false,
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Loader2 size={size} color={color} />
    </Animated.View>
  );
};

// Movie Card - Horizontal layout with poster on left
interface MovieCardProps {
  tracked: TrackedMovieDto;
  isRemoving: boolean;
  onRemove: (movieId: string) => void;
  onPress: () => void;
}

const MovieCard = ({
  tracked,
  isRemoving,
  onRemove,
  onPress,
}: MovieCardProps) => {
  const formattedWatchedDate = tracked.watchedDate
    ? format(new Date(tracked.watchedDate), "MMM d, yyyy • HH:mm")
    : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.card}
      activeOpacity={0.8}
    >
      {/* Poster on the left */}
      <View style={styles.posterContainer}>
        {tracked.movie.posterPath ? (
          <Image
            source={{ uri: `${POSTER_BASE_URL}${tracked.movie.posterPath}` }}
            style={styles.poster}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.poster, styles.noPoster]}>
            <Text style={styles.noPosterText}>No poster</Text>
          </View>
        )}
      </View>

      {/* Content on the right */}
      <View style={styles.cardContent}>
        <View style={styles.info}>
          <Text style={styles.movieTitle} numberOfLines={2}>
            {tracked.movie.title}
          </Text>
          <View style={styles.meta}>
            {tracked.movie.releaseYear && (
              <Text style={styles.year}>{tracked.movie.releaseYear}</Text>
            )}
            {formattedWatchedDate && (
              <>
                <Text style={styles.metaDot}>•</Text>
                <View style={styles.watchedRow}>
                  <CheckCircle2 size={12} color={colors.success} />
                  <Text style={styles.watchedDate}>{formattedWatchedDate}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Remove button */}
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onRemove(tracked.movieId);
          }}
          disabled={isRemoving}
          style={styles.removeButton}
          activeOpacity={0.7}
        >
          {isRemoving ? (
            <SpinningLoader size={14} color={colors.text} />
          ) : (
            <>
              <Trash2 size={14} color={colors.text} />
              <Text style={styles.removeButtonText}>Remove</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

export default function ShelfScreen() {
  const { user, isLoading: isAuthLoading, isAuthenticated, logout } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's tracked movies
  const { data: trackedMovies, isLoading: isMoviesLoading } = useQuery({
    ...moviesControllerGetUserMoviesOptions({
      path: { userDid: user?.did || "" },
    }),
    enabled: !!user?.did,
  });

  // Remove from shelf mutation
  const unmarkMutation = useMutation({
    ...moviesControllerUnmarkWatchedMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: moviesControllerGetUserMoviesQueryKey({
          path: { userDid: user?.did || "" },
        }),
      });
      showToast("Removed from your shelf", "success");
    },
    onError: () => {
      showToast("Failed to remove from shelf. Please try again.", "error");
    },
  });

  const handleRemove = useCallback(
    (movieId: string) => {
      unmarkMutation.mutate({ path: { movieId } });
    },
    [unmarkMutation],
  );

  const handleMoviePress = useCallback((tracked: TrackedMovieDto) => {
    router.push({
      pathname: "/movie/[id]",
      params: {
        id: tracked.movieId,
        title: createTitleSlug(tracked.movie.title),
      },
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: TrackedMovieDto }) => {
      const isRemoving =
        unmarkMutation.isPending &&
        unmarkMutation.variables?.path?.movieId === item.movieId;

      return (
        <MovieCard
          tracked={item}
          isRemoving={isRemoving}
          onRemove={handleRemove}
          onPress={() => handleMoviePress(item)}
        />
      );
    },
    [unmarkMutation, handleRemove, handleMoviePress],
  );

  const keyExtractor = useCallback((item: TrackedMovieDto) => item.id, []);

  const handleAuthAction = useCallback(async () => {
    if (isAuthenticated) {
      await logout();
      showToast("Logged out successfully", "success");
    } else {
      router.push("/login");
    }
  }, [isAuthenticated, logout, showToast]);

  // Loading state
  if (isAuthLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <BookOpen size={32} color={colors.primary} />
            <Text style={styles.title}>My Shelf</Text>
          </View>
        </View>
        <View style={styles.skeletonContainer}>
          {[...Array(6)].map((_, i) => (
            <View key={i} style={styles.skeleton}>
              <View style={[styles.skeletonPoster, { backgroundColor: colors.cardMuted }]} />
              <View style={styles.skeletonContent}>
                <Skeleton width="70%" height={18} />
                <Skeleton width="40%" height={14} style={{ marginTop: spacing.sm }} />
              </View>
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  // Not authenticated state
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <BookOpen size={32} color={colors.primary} />
            <Text style={styles.title}>My Shelf</Text>
          </View>
          <TouchableOpacity onPress={handleAuthAction} style={styles.authButton}>
            <LogIn size={20} color={colors.text} />
            <Text style={styles.authButtonText}>Sign in</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centerContent}>
          <Card style={styles.authCard}>
            <CardHeader style={styles.authCardHeader}>
              <BookOpen
                size={64}
                color={colors.primary}
                style={styles.authIcon}
              />
              <Text style={styles.authTitle}>My Shelf</Text>
              <Text style={styles.authDescription}>
                Sign in to track movies you&apos;ve watched
              </Text>
            </CardHeader>
            <CardContent>
              <Button size="lg" onPress={() => router.push("/login")}>
                <LogIn
                  size={20}
                  color={colors.text}
                  style={styles.buttonIcon}
                />
                <Text style={styles.buttonText}>Sign in</Text>
              </Button>
            </CardContent>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <BookOpen size={32} color={colors.primary} />
          <Text style={styles.title}>My Shelf</Text>
        </View>
        <TouchableOpacity onPress={handleAuthAction} style={styles.authButton}>
          <LogOut size={20} color={colors.text} />
          <Text style={styles.authButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {isMoviesLoading && (
        <View style={styles.skeletonContainer}>
          {[...Array(6)].map((_, i) => (
            <View key={i} style={styles.skeleton}>
              <View style={[styles.skeletonPoster, { backgroundColor: colors.cardMuted }]} />
              <View style={styles.skeletonContent}>
                <Skeleton width="70%" height={18} />
                <Skeleton width="40%" height={14} style={{ marginTop: spacing.sm }} />
              </View>
            </View>
          ))}
        </View>
      )}

      {trackedMovies && trackedMovies.length > 0 && (
        <>
          <Text style={styles.resultsCount}>
            {trackedMovies.length} movie{trackedMovies.length !== 1 ? "s" : ""} watched
          </Text>
          <FlashList
            data={trackedMovies}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
          />
        </>
      )}

      {trackedMovies && trackedMovies.length === 0 && (
        <View style={styles.centerContent}>
          <Card style={styles.emptyCard}>
            <CardHeader style={styles.emptyCardHeader}>
              <BookOpen
                size={64}
                color={colors.textSecondary}
                style={styles.emptyIcon}
              />
              <Text style={styles.emptyTitle}>Your shelf is empty</Text>
              <Text style={styles.emptyDescription}>
                Start tracking movies you&apos;ve watched
              </Text>
            </CardHeader>
            <CardContent>
              <Button onPress={() => router.push("/(tabs)/search")}>
                <Text style={styles.buttonText}>Search for movies</Text>
              </Button>
            </CardContent>
          </Card>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.text,
  },
  authButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
  },
  authButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  resultsCount: {
    fontSize: 14,
    color: colors.textMuted,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  listContent: {
    padding: spacing.lg,
  },
  card: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  posterContainer: {
    width: 80,
    aspectRatio: 2 / 3,
    backgroundColor: colors.cardMuted,
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  cardContent: {
    flex: 1,
    padding: spacing.md,
    justifyContent: "space-between",
  },
  info: {
    flex: 1,
  },
  movieTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.xs,
    lineHeight: 22,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  year: {
    fontSize: 14,
    color: colors.textMuted,
  },
  watchedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  watchedDate: {
    fontSize: 14,
    color: colors.success,
    fontWeight: "500",
  },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.error,
    borderRadius: borderRadius.full,
    alignSelf: "flex-start",
    marginTop: spacing.sm,
  },
  removeButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  itemSeparator: {
    height: spacing.md,
  },
  metaDot: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  noPoster: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.cardMuted,
  },
  noPosterText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "500",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  authCard: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  authCardHeader: {
    alignItems: "center",
  },
  authIcon: {
    marginBottom: spacing.md,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  authDescription: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: "center",
  },
  emptyCard: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  emptyCardHeader: {
    alignItems: "center",
  },
  emptyIcon: {
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  emptyDescription: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
  },
  buttonIcon: {
    marginRight: spacing.sm,
  },
  buttonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  skeletonContainer: {
    padding: spacing.lg,
  },
  skeleton: {
    flexDirection: "row",
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },
  skeletonPoster: {
    width: 80,
    aspectRatio: 2 / 3,
  },
  skeletonContent: {
    flex: 1,
    padding: spacing.md,
    justifyContent: "center",
  },
});
