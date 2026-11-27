import { Link } from "expo-router";
import { Tv } from "lucide-react-native";
import { useState } from "react";
import {
	Pressable,
	useWindowDimensions,
	View,
	type ViewStyle,
} from "react-native";
import { SectionHeader } from "@/components/home/SectionHeader";
import { TourAnchor } from "@/components/tour/WelcomeTour";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { UpNextTile } from "@/components/up-next/UpNextTile";
import { useUpNext } from "@/lib/use-up-next";

/**
 * "Up Next" preview for Home: the next few unwatched episodes across tracked
 * shows as episode-still tiles, each with a one-tap "add to shelf"
 * action. Mirrors the Web App's Home Up Next cards (preview-only, capped) —
 * the full queue lives on the profile Up Next tab, linked via "View all".
 *
 * Reads from the shared `showsControllerGetUserUpNext` procedure (via
 * `useUpNext`); rendered inside the dashboard ScrollView, so it shows a fixed
 * preview slice rather than owning its own scrolling list.
 */
const PREVIEW_COUNT = 3;
const TILE_GAP = 12;

export function UpNextPreview({ handle }: { handle: string | undefined }) {
	const { items, isLoading, isError } = useUpNext(PREVIEW_COUNT);
	const { fontScale } = useWindowDimensions();
	const [listWidth, setListWidth] = useState(0);
	const preview = items.slice(0, PREVIEW_COUNT);
	const twoColumns =
		listWidth / Math.max(1, fontScale) >= 600 &&
		(isLoading || preview.length > 1);
	const tileWidth = twoColumns ? (listWidth - TILE_GAP) / 2 : listWidth;
	const tileStyle: ViewStyle = {
		width: twoColumns ? tileWidth : "100%",
		...(tileWidth > 0
			? { height: Math.min(243, (tileWidth * 9) / 16) }
			: { aspectRatio: 16 / 9 }),
	};

	return (
		<TourAnchor id="up-next">
			<SectionHeader
				title="Up Next"
				right={
					handle ? (
						<View className="flex-row items-center gap-4">
							<Link href="/pick-for-me" asChild>
								<Pressable hitSlop={8}>
									<Text className="font-medium text-accent-text text-sm">
										Pick for me
									</Text>
								</Pressable>
							</Link>
							<Link href={`/profile/${handle}/up-next`} asChild>
								<Pressable hitSlop={8}>
									<Text className="font-medium text-accent-text text-sm">
										View all
									</Text>
								</Pressable>
							</Link>
						</View>
					) : undefined
				}
			/>
			{!isLoading && isError ? (
				<ErrorState message="Couldn't load Up Next. Try again." />
			) : !isLoading && preview.length === 0 ? (
				<EmptyState
					variant="card"
					icon={Tv}
					title="You're all caught up!"
					message="Start tracking shows to see your next episodes here."
					action={{ label: "Discover shows", href: "/search", icon: Tv }}
				/>
			) : (
				<View
					className="flex-row flex-wrap"
					style={{ gap: TILE_GAP }}
					onLayout={({ nativeEvent }) => setListWidth(nativeEvent.layout.width)}
				>
					{isLoading
						? [0, 1, 2].map((i) => (
								<View
									key={i}
									style={tileStyle}
									className="animate-pulse rounded-xl border border-border bg-background-subtle"
								/>
							))
						: preview.map((item) => (
								<UpNextTile
									key={`${item.showId}-${item.nextEpisode.seasonNumber}-${item.nextEpisode.episodeNumber}`}
									item={item}
									style={tileStyle}
								/>
							))}
				</View>
			)}
		</TourAnchor>
	);
}
