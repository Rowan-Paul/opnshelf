import { Link } from "expo-router";
import { Tv } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { SectionHeader } from "@/components/home/SectionHeader";
import { TourAnchor } from "@/components/tour/WelcomeTour";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { UpNextTile } from "@/components/up-next/UpNextTile";
import { useUpNext } from "@/lib/use-up-next";

/**
 * "Up Next" preview for Home: the next few unwatched episodes across tracked
 * shows as a row of episode-still tiles, each with a one-tap "add to shelf"
 * action. Mirrors the Web App's Home Up Next cards (preview-only, capped) —
 * the full queue lives on the profile Up Next tab, linked via "View all".
 *
 * Reads from the shared `showsControllerGetUserUpNext` procedure (via
 * `useUpNext`); rendered inside the dashboard ScrollView, so it shows a fixed
 * preview slice rather than owning its own scrolling list.
 */
/**
 * Stacked full-width tiles, the shape the Web App's Up Next grid takes at
 * phone width. Capped so Home stays short; "View all" has the rest. A sideways
 * row was tried first and hid all but the first tile behind a swipe.
 */
const PREVIEW_COUNT = 3;

export function UpNextPreview({ handle }: { handle: string | undefined }) {
	const { items, isLoading, isError } = useUpNext(PREVIEW_COUNT);

	const preview = items.slice(0, PREVIEW_COUNT);

	return (
		<TourAnchor id="up-next">
			<SectionHeader
				title="Up Next"
				right={
					handle ? (
						<View className="flex-row items-center gap-4">
							<Link href="/pick-for-me" asChild>
								<Pressable hitSlop={8}>
									<Text className="font-medium text-primary text-sm">
										Pick for me
									</Text>
								</Pressable>
							</Link>
							<Link href={`/profile/${handle}/up-next`} asChild>
								<Pressable hitSlop={8}>
									<Text className="font-medium text-primary text-sm">
										View all
									</Text>
								</Pressable>
							</Link>
						</View>
					) : undefined
				}
			/>
			{isLoading ? (
				<View className="gap-3">
					{[0, 1, 2].map((i) => (
						<View
							key={i}
							style={{ aspectRatio: 16 / 9 }}
							className="animate-pulse rounded-xl border border-border bg-background-subtle"
						/>
					))}
				</View>
			) : isError ? (
				<ErrorState message="Couldn't load Up Next. Try again." />
			) : preview.length === 0 ? (
				<EmptyState
					variant="card"
					icon={Tv}
					title="You're all caught up!"
					message="Start tracking shows to see your next episodes here."
					action={{ label: "Discover shows", href: "/search", icon: Tv }}
				/>
			) : (
				<View className="gap-3">
					{preview.map((item) => (
						<UpNextTile
							key={`${item.showId}-${item.nextEpisode.seasonNumber}-${item.nextEpisode.episodeNumber}`}
							item={item}
						/>
					))}
				</View>
			)}
		</TourAnchor>
	);
}
