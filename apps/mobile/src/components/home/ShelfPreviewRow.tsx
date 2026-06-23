import type { ShelfResponseDto } from "@opnshelf/api";
import type { Href } from "expo-router";
import { Film } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import { SectionHeader } from "@/components/home/SectionHeader";
import { MediaCard, type MediaCardItem } from "@/components/media/MediaCard";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useProfileShelf } from "@/lib/use-public-profile";

type ShelfItem = ShelfResponseDto["items"][number];

const POSTER_W = 110;

/**
 * "Your Shelf" recent-watched preview: a horizontal poster row of the user's
 * most recently shelved movies + episodes. Mirrors the web dashboard "Your
 * Shelf" section, reading from the same `shelfControllerGetUserShelf` procedure
 * (via `useProfileShelf`). "View all" deep-links to the full Shelf page on the
 * user's profile.
 */
export function ShelfPreviewRow({ userDid }: { userDid: string }) {
	const { user } = useAuth();
	// The shared shelf query is server-paginated; the first page (newest first)
	// is exactly the recent-watched preview the dashboard wants.
	const { data, isLoading, isError } = useProfileShelf(userDid);

	const items = (data?.items ?? []).slice(0, 10);
	const shelfHref = user?.handle
		? (`/profile/${user.handle}/shelf` as Href)
		: undefined;

	return (
		<View>
			<SectionHeader icon={Film} title="Your Shelf" href={shelfHref} />
			{isLoading ? (
				<ScrollView horizontal showsHorizontalScrollIndicator={false}>
					<View className="flex-row gap-3">
						{[0, 1, 2, 3].map((i) => (
							<View
								key={i}
								style={{ width: POSTER_W }}
								className="aspect-2/3 rounded-lg border border-border bg-card"
							/>
						))}
					</View>
				</ScrollView>
			) : isError ? (
				<EmptyCard text="Couldn't load your shelf." />
			) : items.length === 0 ? (
				<EmptyCard text="Your shelf is empty. Track movies and shows to see them here." />
			) : (
				<ScrollView horizontal showsHorizontalScrollIndicator={false}>
					<View className="flex-row gap-3">
						{items.map((item) => (
							<View key={item.id} style={{ width: POSTER_W }}>
								<MediaCard item={shelfItemToCardItem(item)} actions />
							</View>
						))}
					</View>
				</ScrollView>
			)}
		</View>
	);
}

function EmptyCard({ text }: { text: string }) {
	return (
		<View className="items-center rounded-xl border border-border bg-card p-6">
			<Text className="text-center text-muted-foreground text-sm">{text}</Text>
		</View>
	);
}

/**
 * Maps a shelf entry to a `MediaCard` item. Episodes keep the parent show's
 * poster + id (so the show-keyed action hooks resolve) but carry their episode
 * coordinates and deep-link to the episode page, matching the web dashboard.
 * Shared with the profile Overview episode row so the two can't drift.
 */
export function shelfItemToCardItem(item: ShelfItem): MediaCardItem {
	if (item.type === "movie") {
		return {
			id: Number(item.movieId),
			type: "movie",
			title: item.title,
			posterPath: item.posterPath,
			year: item.releaseYear ? String(item.releaseYear) : undefined,
		};
	}
	return {
		id: Number(item.showId),
		type: "show",
		// Title line shows the episode title; the show drops to the label line.
		title: item.episodeTitle ?? item.showTitle,
		posterPath: item.posterPath,
		href: `/show/${item.showId}/season/${item.seasonNumber}/episode/${item.episodeNumber}` as Href,
		episode: {
			seasonNumber: item.seasonNumber,
			episodeNumber: item.episodeNumber,
			showTitle: item.showTitle,
			episodeTitle: item.episodeTitle,
		},
	};
}
