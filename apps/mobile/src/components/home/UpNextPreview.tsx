import { Tv } from "lucide-react-native";
import { View } from "react-native";
import { SectionHeader } from "@/components/home/SectionHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { UpNextCard } from "@/components/up-next/UpNextCard";
import { useMarkUpNextEpisode, useUpNext } from "@/lib/use-up-next";

/**
 * "Up Next" preview for the home dashboard: the next few unwatched episodes
 * across tracked shows, each with a one-tap "mark watched" action. Mirrors the
 * web dashboard Up Next section (preview-only, capped) — the full infinite
 * queue lives on the profile Up Next tab, linked via "View all".
 *
 * Reads from the shared `showsControllerGetUserUpNext` procedure (via
 * `useUpNext`); rendered inside the dashboard ScrollView, so it shows a fixed
 * preview slice rather than owning its own scrolling list.
 */
export function UpNextPreview({ handle }: { handle: string | undefined }) {
	const { items, isLoading, isError } = useUpNext();
	const markEpisode = useMarkUpNextEpisode();

	const preview = items.slice(0, 4);

	const handleMarkWatched = (
		showId: string,
		seasonNumber: number,
		episodeNumber: number,
	) => {
		markEpisode.mutate({ body: { showId, seasonNumber, episodeNumber } });
	};

	return (
		<View>
			<SectionHeader
				icon={Tv}
				title="Up Next"
				href={handle ? (`/profile/${handle}/up-next` as const) : undefined}
			/>
			{isLoading ? (
				<LoadingState label="Loading your queue…" />
			) : isError ? (
				<ErrorState message="Couldn't load Up Next. Try again." />
			) : preview.length === 0 ? (
				<EmptyState
					icon={Tv}
					title="All caught up!"
					message="No upcoming episodes to watch. Track a show to see it here."
				/>
			) : (
				<View className="gap-3">
					{preview.map((item) => (
						<UpNextCard
							key={`${item.showId}-${item.nextEpisode.seasonNumber}-${item.nextEpisode.episodeNumber}`}
							item={item}
							onMarkWatched={handleMarkWatched}
							isMarking={markEpisode.isPending}
						/>
					))}
				</View>
			)}
		</View>
	);
}
