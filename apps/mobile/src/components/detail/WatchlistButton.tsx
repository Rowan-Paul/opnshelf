import { Bookmark } from "lucide-react-native";
import { Pressable } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { useListMembership } from "@/lib/use-lists";
import { useThemeColors } from "@/theme/colors";

/**
 * Watchlist toggle for media detail screens: a square icon button in the shelf
 * row, filled while the item is on the Watchlist. The Watchlist is the
 * `isDefault` "watchlist" system list, read and written through the same
 * `useListMembership` cache as the list sheet, so both stay in sync. Mirrors
 * the Watchlist button in web's `MediaActionsBar`.
 */
export function WatchlistButton({
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

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={
				isInWatchlist ? "Remove from Watchlist" : "Add to Watchlist"
			}
			accessibilityState={{ selected: isInWatchlist, busy: isPending }}
			onPress={() => toggle("watchlist", isInWatchlist)}
			disabled={isPending}
			className="size-12 items-center justify-center rounded-lg border border-border"
			style={{ opacity: isPending ? 0.6 : 1 }}
		>
			<Bookmark
				color={isInWatchlist ? colors.accent : colors.mutedForeground}
				fill={isInWatchlist ? colors.accent : "transparent"}
				size={20}
			/>
		</Pressable>
	);
}
