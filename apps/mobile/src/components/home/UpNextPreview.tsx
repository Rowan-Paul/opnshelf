import { Link } from "expo-router";
import { Tv } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { SectionHeader } from "@/components/home/SectionHeader";
import { TourAnchor } from "@/components/tour/WelcomeTour";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
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
	const { items, isLoading, isError } = useUpNext(4);

	const preview = items.slice(0, 4);

	return (
		<View>
			<TourAnchor id="up-next">
				<SectionHeader
					icon={Tv}
					title="Up Next"
					right={
						handle ? (
							<View className="flex-row items-center gap-4">
								<Link href="/pick-for-me" asChild>
									<Pressable hitSlop={8}>
										<Text className="font-medium text-muted-foreground text-sm">
											Pick for me
										</Text>
									</Pressable>
								</Link>
								<Link href={`/profile/${handle}/up-next`} asChild>
									<Pressable hitSlop={8}>
										<Text className="font-medium text-muted-foreground text-sm">
											View all
										</Text>
									</Pressable>
								</Link>
							</View>
						) : undefined
					}
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
