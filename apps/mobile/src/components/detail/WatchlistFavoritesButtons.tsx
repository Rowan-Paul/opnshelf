import { Bookmark, Heart } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useListMembership } from "@/lib/use-lists";
import { useThemeColors } from "@/theme/colors";

/**
 * First-class Watchlist + Favorites toggles for media detail screens. These are
 * just the two `isDefault` system lists ("watchlist" / "favorites") surfaced as
 * dedicated buttons instead of being buried inside the `AddToListSheet` — mirrors
 * web's `MediaActionsBar` (`toggleWatchlist` / `toggleFavorites`). Reads/writes
 * go through the same `useListMembership` hook (and thus the same query cache)
 * as `AddToListButton`, so toggling here and in the list sheet stay in sync.
 */
export function WatchlistFavoritesButtons({
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}) {
	const colors = useThemeColors();
	const { isAuthenticated } = useAuth();
	const { memberships, toggle, isPending } = useListMembership({
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	if (!isAuthenticated) return null;

	const isInWatchlist =
		memberships.find((l) => l.listSlug === "watchlist")?.isInList ?? false;
	const isInFavorites =
		memberships.find((l) => l.listSlug === "favorites")?.isInList ?? false;

	return (
		<View className="flex-row gap-2 px-4">
			<Pressable
				onPress={() => toggle("watchlist", isInWatchlist)}
				disabled={isPending}
				className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-border py-3"
				style={{ opacity: isPending ? 0.7 : 1 }}
			>
				<Bookmark
					color={isInWatchlist ? colors.accent : colors.mutedForeground}
					fill={isInWatchlist ? colors.accent : "transparent"}
					size={18}
				/>
				<Text className="font-semibold text-foreground">
					{isInWatchlist ? "In Watchlist" : "Watchlist"}
				</Text>
			</Pressable>
			<Pressable
				onPress={() => toggle("favorites", isInFavorites)}
				disabled={isPending}
				className="items-center justify-center rounded-lg border border-border px-4"
				style={{ opacity: isPending ? 0.7 : 1 }}
				accessibilityLabel={
					isInFavorites ? "Remove from Favorites" : "Add to Favorites"
				}
			>
				<Heart
					color={isInFavorites ? colors.destructive : colors.mutedForeground}
					fill={isInFavorites ? colors.destructive : "transparent"}
					size={20}
				/>
			</Pressable>
		</View>
	);
}
