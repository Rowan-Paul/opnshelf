import { Link } from "expo-router";
import { Star } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
import { posterUrl } from "@/lib/tmdb";

export type MediaCardItem = {
	id: number;
	type: "movie" | "show";
	title: string;
	posterPath?: string | null;
	year?: string;
	rating?: number;
};

/**
 * Poster card for grid/list rendering of movies and shows. Props-driven so
 * search, discover, and future shelf screens can all reuse it. Wraps an
 * Expo Router `Link` to the matching detail route.
 */
export function MediaCard({ item }: { item: MediaCardItem }) {
	const href =
		item.type === "movie"
			? (`/movie/${item.id}` as const)
			: (`/show/${item.id}` as const);

	return (
		<Link href={href} asChild>
			<Pressable className="flex-1">
				<View className="overflow-hidden rounded-lg border border-border bg-card">
					<PosterImage
						url={posterUrl(item.posterPath)}
						className="aspect-2/3 w-full"
					/>
				</View>
				<Text
					className="mt-2 font-medium text-foreground text-sm"
					numberOfLines={1}
				>
					{item.title}
				</Text>
				<View className="mt-0.5 flex-row items-center gap-2">
					{item.year ? (
						<Text className="text-muted-foreground text-xs">{item.year}</Text>
					) : null}
					{item.rating && item.rating > 0 ? (
						<View className="flex-row items-center gap-0.5">
							<Star color="#f3bc00" fill="#f3bc00" size={11} />
							<Text className="text-muted-foreground text-xs">
								{item.rating.toFixed(1)}
							</Text>
						</View>
					) : null}
				</View>
			</Pressable>
		</Link>
	);
}
