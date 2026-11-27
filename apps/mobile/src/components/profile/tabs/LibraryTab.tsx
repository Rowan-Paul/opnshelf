import {
	filterLibraryItems,
	LIBRARY_SORT_OPTIONS,
	type LibraryItemDto,
	type LibrarySort,
	libraryItemTitle,
} from "@opnshelf/api";
import { ArrowUpDown, Disc } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { SortSheet } from "@/components/lists/ListSortSheet";
import { MediaCard, type MediaCardItem } from "@/components/media/MediaCard";
import { Button } from "@/components/ui/button";
import { PosterGridSkeleton } from "@/components/ui/skeletons";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import {
	LIBRARY_FORMATS,
	type LibraryFormat,
	useUserLibrary,
} from "@/lib/use-library";
import { useMediaCardColumns } from "@/lib/use-media-card-columns";
import { useThemeColors } from "@/theme/colors";

export function libraryItemToCardItem(item: LibraryItemDto): MediaCardItem {
	const { media } = item;
	const posterPath =
		typeof media.posterPath === "string" ? media.posterPath : undefined;
	const releaseYear =
		typeof media.releaseYear === "number" ? media.releaseYear : undefined;
	return {
		id: Number(item.mediaId),
		type: item.mediaType === "movie" ? "movie" : "show",
		title: libraryItemTitle(item),
		posterPath,
		year: releaseYear ? String(releaseYear) : undefined,
	};
}

const FILTERS: { key: LibraryFormat | "all"; label: string }[] = [
	{ key: "all", label: "All" },
	...LIBRARY_FORMATS.map((f) => ({ key: f.value, label: f.label })),
];

const SORT_SHEET_OPTIONS = LIBRARY_SORT_OPTIONS.map(({ value, label }) => ({
	key: value,
	label,
}));

export function LibraryTab({ userDid }: { userDid: string }) {
	const [filter, setFilter] = useState<LibraryFormat | "all">("all");
	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<LibrarySort>("added");
	const [sortSheetOpen, setSortSheetOpen] = useState(false);
	const columns = useMediaCardColumns();
	const colors = useThemeColors();
	const { data, isLoading, isError } = useUserLibrary(userDid);
	const sortLabel =
		LIBRARY_SORT_OPTIONS.find(({ value }) => value === sort)?.label ?? "";

	const items = useMemo(
		() => filterLibraryItems(data ?? [], { format: filter, search, sort }),
		[data, filter, search, sort],
	);

	return (
		<View className="gap-4 px-4 pt-4 pb-12">
			<Text className="text-display-2 text-foreground">Library</Text>

			{data && data.length > 0 && (
				<>
					<TextField
						accessibilityLabel="Search Library"
						placeholder="Search by title or Box Set"
						value={search}
						onChangeText={setSearch}
						autoCapitalize="none"
						autoCorrect={false}
						returnKeyType="search"
					/>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={`Sort by ${sortLabel}`}
						onPress={() => setSortSheetOpen(true)}
						className="flex-row items-center gap-1.5 self-start rounded-full bg-background-subtle px-3 py-1.5"
					>
						<ArrowUpDown color={colors.mutedForeground} size={14} />
						<Text className="font-medium text-muted-foreground text-sm">
							{sortLabel}
						</Text>
					</Pressable>
					<SortSheet
						visible={sortSheetOpen}
						onDismiss={() => setSortSheetOpen(false)}
						value={sort}
						onChange={setSort}
						options={SORT_SHEET_OPTIONS}
					/>

					<View className="flex-row flex-wrap gap-2">
						{FILTERS.map((f) => {
							const isActive = filter === f.key;
							return (
								<Pressable
									key={f.key}
									accessibilityRole="button"
									accessibilityState={{ selected: isActive }}
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
				</>
			)}

			{isLoading ? (
				<PosterGridSkeleton columns={columns} />
			) : isError ? (
				<ErrorState message="Couldn't load this library." />
			) : !data?.length ? (
				<EmptyState icon={Disc} title="Nothing owned yet" />
			) : items.length === 0 ? (
				<View className="items-center gap-2 py-10">
					<Text
						accessibilityLiveRegion="polite"
						className="text-muted-foreground text-sm"
					>
						No Library Items match.
					</Text>
					{search !== "" && (
						<Button
							label="Clear search"
							variant="secondary"
							size="sm"
							onPress={() => setSearch("")}
						/>
					)}
				</View>
			) : (
				<View className="flex-row flex-wrap">
					{items.map((item) => (
						<View
							key={item.id}
							className="px-1 pb-3"
							style={{ width: `${100 / columns}%` }}
						>
							<MediaCard item={libraryItemToCardItem(item)} />
						</View>
					))}
				</View>
			)}
		</View>
	);
}
