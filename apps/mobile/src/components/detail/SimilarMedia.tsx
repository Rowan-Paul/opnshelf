import {
	moviesControllerDiscoverMoviesOptions,
	showsControllerDiscoverShowsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { FlatList, View } from "react-native";
import { MediaCard, type MediaCardItem } from "@/components/media/MediaCard";
import { Text } from "@/components/ui/text";
import { yearFromDate } from "@/lib/tmdb";

type SimilarMediaProps =
	| { mediaType: "movie"; mediaId: string }
	| { mediaType: "show"; mediaId: string };

/**
 * Horizontally-scrolling rail of similar / recommended titles, mirroring the
 * web `SimilarMediaGrid`. Pulls from the same discover endpoints the web
 * `useDiscoverMovies` / `useDiscoverShows` hooks use, filters out the current
 * title, and renders the shared `MediaCard` (each tappable to its detail page).
 */
export function SimilarMedia({ mediaType, mediaId }: SimilarMediaProps) {
	if (mediaType === "movie") {
		return <SimilarMovies mediaId={mediaId} />;
	}
	return <SimilarShows mediaId={mediaId} />;
}

function SimilarMovies({ mediaId }: { mediaId: string }) {
	const { data } = useQuery(moviesControllerDiscoverMoviesOptions());

	const items: MediaCardItem[] = (data?.results ?? [])
		.filter((m) => m.id !== Number(mediaId))
		.slice(0, 12)
		.map((m) => ({
			id: m.id,
			type: "movie",
			title: m.title,
			posterPath: m.poster_path,
			year: yearFromDate(m.release_date),
			rating: m.vote_average,
		}));

	return <SimilarRail title="Similar Movies" items={items} />;
}

function SimilarShows({ mediaId }: { mediaId: string }) {
	const { data } = useQuery(showsControllerDiscoverShowsOptions());

	const items: MediaCardItem[] = (data?.results ?? [])
		.filter((s) => s.id !== Number(mediaId))
		.slice(0, 12)
		.map((s) => ({
			id: s.id,
			type: "show",
			title: s.name,
			posterPath: s.poster_path,
			year: yearFromDate(s.first_air_date),
			rating: s.vote_average,
		}));

	return <SimilarRail title="Similar Shows" items={items} />;
}

function SimilarRail({
	title,
	items,
}: {
	title: string;
	items: MediaCardItem[];
}) {
	if (items.length === 0) return null;
	return (
		<View>
			<Text className="mb-3 px-4 font-display font-semibold text-base text-foreground">
				{title}
			</Text>
			<FlatList
				horizontal
				data={items}
				keyExtractor={(item) => `${item.type}-${item.id}`}
				renderItem={({ item }) => (
					<View className="w-28">
						<MediaCard item={item} />
					</View>
				)}
				showsHorizontalScrollIndicator={false}
				contentContainerClassName="gap-3 px-4"
			/>
		</View>
	);
}
