import { Tv } from "lucide-react-native";
import { View } from "react-native";
import { SectionHeader } from "@/components/home/SectionHeader";
import { TourAnchor } from "@/components/tour/WelcomeTour";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { UpNextCard } from "@/components/up-next/UpNextCard";
import { UpNextSkeleton } from "@/components/up-next/UpNextSkeleton";
import { useUpNext } from "@/lib/use-up-next";

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

	const preview = items.slice(0, 4);

	return (
		<View>
			<TourAnchor id="up-next">
				<SectionHeader
					icon={Tv}
					title="Up Next"
					href={handle ? (`/profile/${handle}/up-next` as const) : undefined}
				/>
			</TourAnchor>
			{isLoading ? (
				<UpNextSkeleton />
			) : isError ? (
				<ErrorState message="Couldn't load Up Next. Try again." />
			) : preview.length === 0 ? (
				<EmptyState
					icon={Tv}
					title="All caught up!"
					message="No upcoming episodes to watch. Track a show to see it here."
					action={{ label: "Find a show", href: "/search" }}
				/>
			) : (
				<View className="gap-3">
					{preview.map((item) => (
						<UpNextCard
							key={`${item.showId}-${item.nextEpisode.seasonNumber}-${item.nextEpisode.episodeNumber}`}
							item={item}
						/>
					))}
				</View>
			)}
		</View>
	);
}
