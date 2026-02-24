import type { ColorTheme } from "./types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  showsControllerGetShowWatchHistoryQueryKey,
  showsControllerGetUserShowsQueryKey,
  showsControllerMarkSeasonWatchedMutation,
  showsControllerUnmarkWatchedMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MediaCard } from "@/components/MediaCard";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";

const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";

interface SeasonCardProps {
  showId: string;
  seasonNumber: number;
  posterUrl?: string | null;
  airDate?: string;
  episodeCount: number;
  watchedCount: number;
  overview?: string;
  colors: ColorTheme;
  userDid?: string;
  onPress: () => void;
}

export function SeasonCard({
  showId,
  seasonNumber,
  posterUrl,
  airDate,
  episodeCount,
  watchedCount,
  overview,
  colors,
  userDid,
  onPress,
}: SeasonCardProps) {
  const { colors: themeColors } = useTheme();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const progress =
    episodeCount > 0 ? Math.round((watchedCount / episodeCount) * 100) : 0;
  const hasWatchedEpisodes = watchedCount > 0;

  const markMutation = useMutation({
    mutationKey: ["shows", showId, "seasons", seasonNumber, "markSeasonWatched"],
    ...showsControllerMarkSeasonWatchedMutation(),
    onSuccess: (data) => {
      if (userDid) {
        queryClient.invalidateQueries({
          queryKey: showsControllerGetUserShowsQueryKey({
            path: { userDid },
          }),
        });
        queryClient.invalidateQueries({
          queryKey: showsControllerGetShowWatchHistoryQueryKey({
            path: { userDid, showId },
          }),
        });
      }
      showToast(`Marked ${data.count} episodes as watched`);
    },
    onError: () => {
      showToast("Failed to mark season as watched. Please try again.", "error");
    },
  });

  const unmarkMutation = useMutation({
    mutationKey: ["shows", showId, "seasons", seasonNumber, "unmarkSeasonWatched"],
    ...showsControllerUnmarkWatchedMutation(),
    onSuccess: () => {
      if (userDid) {
        queryClient.invalidateQueries({
          queryKey: showsControllerGetUserShowsQueryKey({
            path: { userDid },
          }),
        });
        queryClient.invalidateQueries({
          queryKey: showsControllerGetShowWatchHistoryQueryKey({
            path: { userDid, showId },
          }),
        });
      }
      showToast("Removed season from your shelf");
    },
    onError: () => {
      showToast("Failed to remove from shelf. Please try again.", "error");
    },
  });

  const isPending = markMutation.isPending || unmarkMutation.isPending;

  const handleToggleWatched = (e: any) => {
    e.preventDefault();
    e.stopPropagation();

    if (hasWatchedEpisodes) {
      unmarkMutation.mutate({
        path: { showId },
        query: { mode: "all", seasonNumber },
      });
    } else {
      markMutation.mutate({
        body: { showId, seasonNumber },
      });
    }
  };

  const fullPosterUrl = posterUrl
    ? posterUrl.startsWith("http")
      ? posterUrl
      : `${POSTER_BASE_URL}${posterUrl}`
    : null;

  const year = airDate ? new Date(airDate).getFullYear() : null;

  return (
    <MediaCard
      onPress={onPress}
      cardStyle={{
        borderColor: hasWatchedEpisodes
          ? `${colors.primary}40`
          : themeColors.outline,
        backgroundColor: `${themeColors.surfaceContainer}50`,
      }}
      mediaContainerStyle={{
        width: 80,
        minHeight: 120,
      }}
      media={
        fullPosterUrl ? (
          <Image
            source={{ uri: fullPosterUrl }}
            style={styles.poster}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.poster, styles.noPoster]}>
            <Ionicons name="film-outline" size={24} color="#6b7280" />
          </View>
        )
      }
      contentStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.primary }]}>
          Season {seasonNumber}
        </Text>
        {year && (
          <Text style={[styles.year, { color: themeColors.onSurfaceVariant }]}>
            {year}
          </Text>
        )}
      </View>

      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Ionicons
            name="film-outline"
            size={12}
            color={themeColors.onSurfaceVariant}
          />
          <Text style={[styles.metaText, { color: themeColors.onSurfaceVariant }]}>
            {episodeCount} episodes
          </Text>
        </View>
        {watchedCount > 0 && (
          <Text style={[styles.watchedText, { color: themeColors.onSurface }]}>
            {watchedCount} watched
          </Text>
        )}
      </View>

      {overview && (
        <Text
          style={[styles.overview, { color: themeColors.onSurfaceVariant }]}
          numberOfLines={2}
        >
          {overview}
        </Text>
      )}

      {episodeCount > 0 && (
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressTrack,
              { backgroundColor: themeColors.surfaceVariant },
            ]}
          >
            <View
              style={[
                styles.progressBar,
                {
                  width: `${progress}%`,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </View>
        </View>
      )}

      {userDid && (
        <TouchableOpacity
          onPress={handleToggleWatched}
          disabled={isPending}
          style={[
            styles.addButton,
            {
              backgroundColor: hasWatchedEpisodes
                ? `${themeColors.error}20`
                : `${colors.primary}20`,
              borderColor: hasWatchedEpisodes
                ? themeColors.error
                : colors.primary,
            },
          ]}
          activeOpacity={0.7}
        >
          {isPending ? (
            <>
              <ActivityIndicator
                size="small"
                color={hasWatchedEpisodes ? themeColors.error : colors.primary}
              />
              <Text
                style={[
                  styles.addButtonText,
                  {
                    color: hasWatchedEpisodes
                      ? themeColors.error
                      : colors.primary,
                  },
                ]}
              >
                Loading
              </Text>
            </>
          ) : (
            <>
              <Ionicons
                name={hasWatchedEpisodes ? "trash-outline" : "add"}
                size={14}
                color={hasWatchedEpisodes ? themeColors.error : colors.primary}
              />
              <Text
                style={[
                  styles.addButtonText,
                  {
                    color: hasWatchedEpisodes
                      ? themeColors.error
                      : colors.primary,
                  },
                ]}
              >
                {hasWatchedEpisodes ? "Remove from Shelf" : "Add to Shelf"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </MediaCard>
  );
}

const styles = StyleSheet.create({
  poster: {
    width: "100%",
    height: "100%",
  },
  noPoster: {
    backgroundColor: "#1f2937",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    gap: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 1,
  },
  year: {
    fontSize: 12,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  watchedText: {
    fontSize: 12,
    fontWeight: "500",
  },
  overview: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: spacing.xs,
  },
  progressContainer: {
    marginTop: spacing.xs,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 2,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
