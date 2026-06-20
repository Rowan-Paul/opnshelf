import type { ShelfResponseDto } from "@opnshelf/api";
import { Film } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import { SectionHeader } from "@/components/home/SectionHeader";
import { MediaCard, type MediaCardItem } from "@/components/media/MediaCard";
import { Text } from "@/components/ui/text";
import { useProfileShelf } from "@/lib/use-public-profile";

type ShelfItem = ShelfResponseDto["items"][number];

const POSTER_W = 110;

/**
 * "Your Shelf" recent-watched preview: a horizontal poster row of the user's
 * most recently shelved movies + episodes. Mirrors the web dashboard "Your
 * Shelf" section, reading from the same `shelfControllerGetUserShelf` procedure
 * (via `useProfileShelf`). "View all" deep-links to the Shelf tab.
 */
export function ShelfPreviewRow({ userDid }: { userDid: string }) {
	// The shared shelf query is server-paginated; the first page (newest first)
	// is exactly the recent-watched preview the dashboard wants.
	const { data, isLoading, isError } = useProfileShelf(userDid);

	const items = (data?.items ?? []).slice(0, 10).map(toCardItem);

	return (
		<View>
			<SectionHeader icon={Film} title="Your Shelf" href="/shelf" />
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
							<View key={`${item.type}-${item.id}`} style={{ width: POSTER_W }}>
								<MediaCard item={item} />
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

function toCardItem(item: ShelfItem): MediaCardItem {
	if (item.type === "movie") {
		return {
			id: Number(item.movieId),
			type: "movie",
			title: item.title,
			posterPath: item.posterPath,
			year: item.releaseYear ? String(item.releaseYear) : undefined,
		};
	}
	// Episodes link back to their parent show.
	return {
		id: Number(item.showId),
		type: "show",
		title: item.showTitle,
		posterPath: item.posterPath,
		year: item.firstAirYear ? String(item.firstAirYear) : undefined,
	};
}
