import { Check, Eye } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useWatchActions } from "@/lib/use-watch-actions";
import { useWatchStatus } from "@/lib/use-watch-status";

/**
 * Toggle button to mark a single episode watched / unwatched. Reads watched
 * state from the show watch-history and writes through the optimistic show
 * mutations. Used on the episode detail screen.
 */
export function EpisodeWatchButton({
	showId,
	seasonNumber,
	episodeNumber,
}: {
	showId: string;
	seasonNumber: number;
	episodeNumber: number;
}) {
	const { isAuthenticated } = useAuth();
	const status = useWatchStatus({ mediaType: "show", showId });
	const actions = useWatchActions({ mediaType: "show", showId });

	if (!isAuthenticated) return null;

	const isWatched = status.isEpisodeWatched?.(seasonNumber, episodeNumber);
	const isPending = isWatched
		? actions.isUnmarkEpisodePending
		: actions.isMarkEpisodePending;

	const toggle = () => {
		if (isWatched) {
			actions.unmarkEpisodeWatched(seasonNumber, episodeNumber, "all");
		} else {
			actions.markEpisodeWatched(seasonNumber, episodeNumber);
		}
	};

	return (
		<Pressable
			onPress={toggle}
			disabled={isPending}
			className={
				isWatched
					? "flex-row items-center justify-center gap-2 rounded-lg border border-border bg-card py-3"
					: "flex-row items-center justify-center gap-2 rounded-lg bg-primary py-3"
			}
			style={{ opacity: isPending ? 0.7 : 1 }}
		>
			{isWatched ? (
				<>
					<View className="rounded-full bg-primary/20 p-1">
						<Check color="#22c55e" size={14} />
					</View>
					<Text className="font-semibold text-foreground">Watched</Text>
				</>
			) : (
				<>
					<Eye color="#3f2e00" size={18} />
					<Text className="font-semibold text-primary-foreground">
						Mark watched
					</Text>
				</>
			)}
		</Pressable>
	);
}
