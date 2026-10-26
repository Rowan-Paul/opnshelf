import type { MediaInListDto } from "@opnshelf/api";
import { ArrowUpDown, Search, X } from "lucide-react-native";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import { getMediaTitle } from "@/lib/list-media";
import { useDebounce } from "@/lib/use-debounce";
import type { ListSort } from "@/lib/use-lists";
import { useThemeColors } from "@/theme/colors";
import { sortLabel } from "./ListSortSheet";

export type ListItemsFilter = "all" | "movie" | "show" | "unwatched";

const FILTERS: { key: ListItemsFilter; label: string }[] = [
	{ key: "all", label: "All" },
	{ key: "movie", label: "Movies" },
	{ key: "show", label: "Shows" },
	{ key: "unwatched", label: "Unwatched" },
];

/** Shared empty / no-match copy for both list screens, matching Web. */
export const LIST_EMPTY_TITLE = "Empty list";
export const LIST_EMPTY_OWNER_MESSAGE =
	"Add movies and shows to this list to see them here.";
export const LIST_NO_MATCHES_TITLE = "No matches";
export const LIST_NO_MATCHES_MESSAGE = "Try adjusting your search or filters.";

/** Client-side media/unwatched filter plus title search, matching Web. */
export function filterListItems(
	items: MediaInListDto[],
	filter: ListItemsFilter,
	search: string,
): MediaInListDto[] {
	const query = search.trim().toLowerCase();
	return items.filter((item) => {
		if (filter === "movie" && item.mediaType !== "movie") return false;
		if (filter === "show" && item.mediaType === "movie") return false;
		if (filter === "unwatched" && item.watched) return false;
		if (!query) return true;
		return (
			getMediaTitle(item.media ?? {})
				.toLowerCase()
				.includes(query) ||
			(item.episodeName ?? "").toLowerCase().includes(query)
		);
	});
}

/**
 * Search + filter state for a paged list screen. Filtering is client-side
 * (matching the web list page), so the remaining pages load eagerly while a
 * query is active — otherwise matches on unloaded pages stay invisible.
 */
export function useListItemsFilter(
	items: MediaInListDto[],
	paging: {
		hasNextPage: boolean;
		isFetchingNextPage: boolean;
		fetchNextPage: () => unknown;
	},
) {
	const [filter, setFilter] = useState<ListItemsFilter>("all");
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebounce(search.trim(), 350);
	const { hasNextPage, isFetchingNextPage, fetchNextPage } = paging;

	const filteredItems = useMemo(
		() => filterListItems(items, filter, debouncedSearch),
		[items, filter, debouncedSearch],
	);

	useEffect(() => {
		if (debouncedSearch && hasNextPage && !isFetchingNextPage) {
			void fetchNextPage();
		}
	}, [debouncedSearch, hasNextPage, isFetchingNextPage, fetchNextPage]);

	return {
		filter,
		setFilter,
		search,
		setSearch,
		filteredItems,
		isFiltered: !!debouncedSearch || filter !== "all",
	};
}

/**
 * Search field, sort pill and media filter pills above a list's grid. Shown
 * to every viewer; owner-only controls (Reorder) slot in via `trailing`.
 */
export function ListItemsToolbar({
	search,
	onSearchChange,
	sort,
	onSortPress,
	filter,
	onFilterChange,
	trailing,
}: {
	search: string;
	onSearchChange: (value: string) => void;
	sort: ListSort;
	onSortPress: () => void;
	filter: ListItemsFilter;
	onFilterChange: (filter: ListItemsFilter) => void;
	trailing?: ReactNode;
}) {
	const themeColors = useThemeColors();
	return (
		<>
			<TextField
				leading={<Search color={themeColors.mutedForeground} size={18} />}
				trailing={
					search.length > 0 ? (
						<Pressable hitSlop={8} onPress={() => onSearchChange("")}>
							<X color={themeColors.mutedForeground} size={18} />
						</Pressable>
					) : null
				}
				value={search}
				onChangeText={onSearchChange}
				placeholder="Search list…"
				autoCapitalize="none"
				autoCorrect={false}
			/>

			<View className="flex-row items-center justify-between">
				<Pressable
					onPress={onSortPress}
					className="flex-row items-center gap-1.5 rounded-full bg-background-subtle px-3 py-1.5"
				>
					<ArrowUpDown color={themeColors.mutedForeground} size={14} />
					<Text className="font-medium text-muted-foreground text-sm">
						{sortLabel(sort)}
					</Text>
				</Pressable>
				{trailing}
			</View>

			<View className="flex-row flex-wrap gap-2">
				{FILTERS.map((f) => {
					const isActive = filter === f.key;
					return (
						<Pressable
							key={f.key}
							onPress={() => onFilterChange(f.key)}
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
	);
}
