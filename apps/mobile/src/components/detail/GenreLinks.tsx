import { genreDiscoverySearch } from "@opnshelf/api";
import { Link } from "expo-router";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";

export function GenreLinks({
	genres,
	mediaType,
	compact = false,
}: {
	genres?: { id: number; name: string }[];
	mediaType: "movie" | "show";
	compact?: boolean;
}) {
	return (
		<View
			className={`flex-row flex-wrap gap-2 ${compact ? "flex-1 justify-end" : "mt-2"}`}
		>
			{genres?.map((genre) => (
				<Link
					key={genre.id}
					href={{
						pathname: "/search",
						params: genreDiscoverySearch(mediaType, genre),
					}}
					asChild
				>
					<Pressable
						accessibilityRole="link"
						className={
							compact ? "py-1" : "rounded-full bg-background-subtle px-3 py-1"
						}
						hitSlop={4}
					>
						<Text
							className={
								compact ? "text-primary text-sm" : "text-primary text-xs"
							}
						>
							{genre.name}
						</Text>
					</Pressable>
				</Link>
			))}
		</View>
	);
}
