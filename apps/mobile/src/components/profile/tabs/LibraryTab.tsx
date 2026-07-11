import type { LibraryItemDto } from "@opnshelf/api";
import { Disc } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { MediaCard, type MediaCardItem } from "@/components/media/MediaCard";
import { PosterGridSkeleton } from "@/components/ui/skeletons";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import {
	LIBRARY_FORMATS,
	type LibraryFormat,
	useUserLibrary,
} from "@/lib/use-library";

export function libraryItemToCardItem(item: LibraryItemDto): MediaCardItem {
	const media = item.media as Record<string, unknown>;
	const title =
		(typeof media.title === "string" && media.title) ||
		(typeof media.name === "string" && media.name) ||
		"Unknown";
	const posterPath =
		typeof media.posterPath === "string" ? media.posterPath : undefined;
	const releaseYear =
		typeof media.releaseYear === "number" ? media.releaseYear : undefined;
	return {
		id: Number(item.mediaId),
		type: item.mediaType === "movie" ? "movie" : "show",
		title,
		posterPath,
		year: releaseYear ? String(releaseYear) : undefined,
	};
}

const FILTERS: { key: LibraryFormat | "all"; label: string }[] = [
	{ key: "all", label: "All" },
	...LIBRARY_FORMATS.map((f) => ({ key: f.value, label: f.label })),
];

/**
 * Library tab: the user's owned films, newest first, with Format filter pills.
 * Mirrors ShelfTab's grid; rendered inside the parent screen's scroll view.
 */
export function LibraryTab({ userDid }: { userDid: string }) {
	const [filter, setFilter] = useState<LibraryFormat | "all">("all");
	const { data, isLoading, isError } = useUserLibrary(userDid);

	const items = useMemo(() => {
		const all = data ?? [];
		return filter === "all" ? all : all.filter((i) => i.format === filter);
	}, [data, filter]);

	return (
		<View className="gap-4 px-4 pt-4 pb-12">
			<View className="flex-row flex-wrap gap-2">
				{FILTERS.map((f) => {
					const isActive = filter === f.key;
					return (
						<Pressable
							key={f.key}
							onPress={() => setFilter(f.key)}
							className={cn(
								"rounded-full px-3 py-1.5",
								isActive ? "bg-primary" : "bg-background-subtle",
							)}
						>
							<Text
								className={cn(
									"font-medium text-sm",
									isActive
										? "text-primary-foreground"
										: "text-muted-foreground",
								)}
							>
								{f.label}
							</Text>
						</Pressable>
					);
				})}
			</View>

			{isLoading ? (
				<PosterGridSkeleton />
			) : isError ? (
				<ErrorState message="Couldn't load this library." />
			) : items.length === 0 ? (
				<EmptyState icon={Disc} title="Nothing owned yet" />
			) : (
				<View className="flex-row flex-wrap">
					{items.map((item) => (
						<View key={item.id} className="w-1/3 px-1 pb-3">
							<MediaCard item={libraryItemToCardItem(item)} />
						</View>
					))}
				</View>
			)}
		</View>
	);
}
