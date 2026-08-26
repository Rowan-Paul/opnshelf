import type { ShelfResponseDto } from "@opnshelf/api";
import {
	Check,
	ChevronDown,
	Film,
	Search,
	SlidersHorizontal,
	Tv,
	X,
} from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { shelfItemToCardItem } from "@/components/home/ShelfPreviewRow";
import { MediaCard } from "@/components/media/MediaCard";
import { PosterGridSkeleton } from "@/components/ui/skeletons";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import { groupShelfSections } from "@/lib/shelf-sections";
import { useDebounce } from "@/lib/use-debounce";
import { useMediaCardColumns } from "@/lib/use-media-card-columns";
import { useProfileShelf } from "@/lib/use-public-profile";
import { useWatchActions } from "@/lib/use-watch-actions";

type Filter = "all" | "movie" | "episode";
type SortOrder = "newest" | "oldest";

function sectionLabel(date: string): string {
	const watched = new Date(date);
	const now = new Date();
	const startOfToday = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	);
	const startOfWatched = new Date(
		watched.getFullYear(),
		watched.getMonth(),
		watched.getDate(),
	);
	const days = Math.round(
		(startOfToday.getTime() - startOfWatched.getTime()) / 86_400_000,
	);
	const weekday = new Intl.DateTimeFormat(undefined, {
		weekday: "long",
	}).format(watched);
	if (days === 0) return `Today · ${weekday}`;
	if (days === 1) return `Yesterday · ${weekday}`;
	return new Intl.DateTimeFormat(undefined, {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(watched);
}

const FILTERS: { key: Filter; label: string; icon?: typeof Film }[] = [
	{ key: "all", label: "All" },
	{ key: "movie", label: "Movies", icon: Film },
	{ key: "episode", label: "TV", icon: Tv },
];

/**
 * Shelf tab: server-paginated grid of the user's watched movies + episodes,
 * with type filter pills and a search box. Mirrors the web shelf page.
 * Rendered inside the parent screen's scroll view, so it does not own a list.
 */
export function ShelfTab({
	userDid,
	isOwner = false,
	initialFilter = "all",
}: {
	userDid: string;
	isOwner?: boolean;
	initialFilter?: Filter;
}) {
	const [filter, setFilter] = useState<Filter>(initialFilter);
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [showDividers, setShowDividers] = useState(true);
	const [sort, setSort] = useState<SortOrder>("newest");
	const [viewSheetVisible, setViewSheetVisible] = useState(false);
	const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
		new Set(),
	);
	const debounced = useDebounce(search.trim(), 350);
	const columns = useMediaCardColumns();

	const { data, isLoading, isError } = useProfileShelf(userDid, {
		page,
		type: filter === "all" ? undefined : filter,
		search: debounced,
		sortOrder: sort === "oldest" ? "asc" : "desc",
	});

	const items = data?.items ?? [];
	const sections = groupShelfSections(items, sectionLabel);
	const totalPages = data?.totalPages ?? 1;

	const changeFilter = (next: Filter) => {
		setFilter(next);
		setPage(1);
	};
	const changeSort = (next: SortOrder) => {
		setSort(next);
		setPage(1);
	};
	const toggleSection = (label: string) => {
		setCollapsedSections((current) => {
			const next = new Set(current);
			if (next.has(label)) next.delete(label);
			else next.add(label);
			return next;
		});
	};

	return (
		<View className="gap-4 px-4 pt-4 pb-12">
			<TextField
				leading={<Search color="#94a3b8" size={18} />}
				trailing={
					search.length > 0 ? (
						<Pressable hitSlop={8} onPress={() => setSearch("")}>
							<X color="#94a3b8" size={18} />
						</Pressable>
					) : null
				}
				value={search}
				onChangeText={(v) => {
					setSearch(v);
					setPage(1);
				}}
				placeholder="Search shelf…"
				autoCapitalize="none"
				autoCorrect={false}
			/>

			<View className="flex-row items-center justify-between gap-3">
				<View className="flex-1 flex-row flex-wrap gap-2">
					{FILTERS.map((f) => {
						const isActive = filter === f.key;
						const Icon = f.icon;
						return (
							<Pressable
								key={f.key}
								onPress={() => changeFilter(f.key)}
								className={cn(
									"flex-row items-center gap-1.5 rounded-full px-3 py-1.5",
									isActive ? "bg-primary" : "bg-background-subtle",
								)}
							>
								{Icon ? (
									<Icon color={isActive ? "#3f2e00" : "#94a3b8"} size={14} />
								) : null}
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

				<Pressable
					onPress={() => setViewSheetVisible(true)}
					accessibilityRole="button"
					accessibilityLabel="View options"
					className="flex-row items-center gap-1.5 rounded-full bg-background-subtle px-3 py-1.5"
				>
					<SlidersHorizontal color="#94a3b8" size={14} />
					<Text className="font-medium text-muted-foreground text-sm">
						View
					</Text>
					<ChevronDown color="#94a3b8" size={14} />
				</Pressable>
			</View>

			<ShelfViewSheet
				visible={viewSheetVisible}
				onDismiss={() => setViewSheetVisible(false)}
				groupByDate={showDividers}
				onGroupByDateChange={setShowDividers}
				sort={sort}
				onSortChange={changeSort}
			/>

			{isLoading ? (
				<PosterGridSkeleton columns={columns} />
			) : isError ? (
				<ErrorState message="Couldn't load this shelf." />
			) : items.length === 0 ? (
				<EmptyState
					icon={Film}
					title={debounced ? "No results" : "Shelf is empty"}
					message={debounced ? `Nothing matched “${debounced}”.` : undefined}
				/>
			) : showDividers ? (
				<View className="gap-6">
					{sections.map((section) => {
						const collapsed = collapsedSections.has(section.label);
						return (
							<View key={section.label} className="gap-3">
								<Pressable
									onPress={() => toggleSection(section.label)}
									accessibilityRole="button"
									accessibilityState={{ expanded: !collapsed }}
									accessibilityLabel={`${collapsed ? "Expand" : "Collapse"} ${section.label}`}
									className="flex-row items-center justify-between border-border border-b pb-2"
								>
									<Text className="font-display font-semibold text-foreground text-lg">
										{section.label}
									</Text>
									<ChevronDown
										color="#94a3b8"
										size={18}
										style={{
											transform: [{ rotate: collapsed ? "-90deg" : "0deg" }],
										}}
									/>
								</Pressable>
								{collapsed ? null : (
									<View className="flex-row flex-wrap">
										{section.items.map((item) => (
											<ShelfWatchCard
												key={item.id}
												item={item}
												isOwner={isOwner}
												columns={columns}
											/>
										))}
									</View>
								)}
							</View>
						);
					})}
				</View>
			) : (
				<View className="flex-row flex-wrap">
					{items.map((item) => (
						<ShelfWatchCard
							key={item.id}
							item={item}
							isOwner={isOwner}
							columns={columns}
						/>
					))}
				</View>
			)}

			{totalPages > 1 ? (
				<View className="flex-row items-center justify-center gap-4 pt-2">
					<Pressable
						disabled={page <= 1}
						onPress={() => setPage((p) => Math.max(1, p - 1))}
						className={cn(
							"rounded-lg border border-border px-4 py-2",
							page <= 1 && "opacity-40",
						)}
					>
						<Text className="font-medium text-foreground text-sm">Prev</Text>
					</Pressable>
					<Text className="text-muted-foreground text-sm">
						{page} / {totalPages}
					</Text>
					<Pressable
						disabled={page >= totalPages}
						onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
						className={cn(
							"rounded-lg border border-border px-4 py-2",
							page >= totalPages && "opacity-40",
						)}
					>
						<Text className="font-medium text-foreground text-sm">Next</Text>
					</Pressable>
				</View>
			) : null}
		</View>
	);
}

function ShelfWatchCard({
	item,
	isOwner,
	columns,
}: {
	item: ShelfResponseDto["items"][number];
	isOwner: boolean;
	columns: number;
}) {
	const isMovie = item.type === "movie";
	const actions = useWatchActions(
		isMovie
			? { mediaType: "movie", movieId: item.movieId }
			: { mediaType: "show", showId: item.showId },
	);
	const watchId = item.id.replace(/^(movie|episode):/, "");
	const remove = () => {
		if (isMovie) actions.deleteMovieWatchHistoryEntry(watchId);
		else actions.deleteEpisodeWatchHistoryEntry(watchId);
	};

	return (
		<View className="px-1 pb-3" style={{ width: `${100 / columns}%` }}>
			<MediaCard
				item={shelfItemToCardItem(item)}
				onRemove={isOwner ? remove : undefined}
				// Each card mounts its own mutation, so removing several at once
				// spins only the cards actually being removed.
				isRemoving={
					isMovie
						? actions.isDeleteMovieEntryPending
						: actions.isDeleteEpisodeEntryPending
				}
			/>
		</View>
	);
}

const SORT_OPTIONS: { key: SortOrder; label: string }[] = [
	{ key: "newest", label: "Newest first" },
	{ key: "oldest", label: "Oldest first" },
];

/** Bottom sheet behind the "View" pill: date grouping + sort. Mirrors the web
 * shelf's View dropdown. */
function ShelfViewSheet({
	visible,
	onDismiss,
	groupByDate,
	onGroupByDateChange,
	sort,
	onSortChange,
}: {
	visible: boolean;
	onDismiss: () => void;
	groupByDate: boolean;
	onGroupByDateChange: (grouped: boolean) => void;
	sort: SortOrder;
	onSortChange: (sort: SortOrder) => void;
}) {
	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent
			onRequestClose={onDismiss}
		>
			<View className="flex-1 justify-end">
				<Pressable className="flex-1" onPress={onDismiss} />
				<View className="gap-3 rounded-t-2xl border border-border bg-card p-5">
					<View className="flex-row items-center justify-between">
						<Text className="font-bold font-display text-foreground text-lg">
							View
						</Text>
						<Pressable hitSlop={8} onPress={onDismiss}>
							<X color="#94a3b8" size={22} />
						</Pressable>
					</View>

					<Pressable
						onPress={() => onGroupByDateChange(!groupByDate)}
						accessibilityRole="switch"
						accessibilityState={{ checked: groupByDate }}
						className="flex-row items-center justify-between rounded-lg border border-border p-3"
					>
						<Text
							className={cn(
								"font-medium text-sm",
								groupByDate ? "text-foreground" : "text-muted-foreground",
							)}
						>
							Group by date
						</Text>
						{groupByDate ? (
							<Check color="#f3bc00" size={18} strokeWidth={3} />
						) : null}
					</Pressable>

					<Text className="font-semibold text-muted-foreground text-xs uppercase">
						Sort
					</Text>
					<View className="gap-2">
						{SORT_OPTIONS.map((option) => {
							const isActive = sort === option.key;
							return (
								<Pressable
									key={option.key}
									onPress={() => {
										onSortChange(option.key);
										onDismiss();
									}}
									className="flex-row items-center justify-between rounded-lg border border-border p-3"
								>
									<Text
										className={cn(
											"font-medium text-sm",
											isActive ? "text-foreground" : "text-muted-foreground",
										)}
									>
										{option.label}
									</Text>
									{isActive ? (
										<Check color="#f3bc00" size={18} strokeWidth={3} />
									) : null}
								</Pressable>
							);
						})}
					</View>
				</View>
			</View>
		</Modal>
	);
}
