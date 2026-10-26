import type { MediaInListDto } from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import {
	Stack,
	useFocusEffect,
	useLocalSearchParams,
	useRouter,
} from "expo-router";
import {
	ArrowUpDown,
	List as ListIcon,
	ListOrdered,
	Pencil,
	Plus,
	Search,
	Share2,
	Trash2,
	X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	RefreshControl,
	ScrollView,
	Share,
	View,
} from "react-native";
import { HeaderBackButton } from "@/components/AppHeader";
import { AddItemsToListSheet } from "@/components/lists/AddItemsToListSheet";
import { ListEditorSheet } from "@/components/lists/ListEditorSheet";
import { ListInfoCard } from "@/components/lists/ListInfoCard";
import { ListSortSheet, sortLabel } from "@/components/lists/ListSortSheet";
import { ReorderableItemGrid } from "@/components/lists/ReorderableItemGrid";
import { MediaCard } from "@/components/media/MediaCard";
import { useDialog } from "@/components/ui/dialog";
import { PosterGridSkeleton } from "@/components/ui/skeletons";
import {
	EmptyState,
	ErrorState,
	StaleDataNotice,
} from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/cn";
import { getMediaTitle, listItemToMediaCardItem } from "@/lib/list-media";
import { posthog } from "@/lib/posthog";
import { useDebounce } from "@/lib/use-debounce";
import {
	type ListSort,
	useDeleteList,
	useList,
	useRemoveListItem,
	useReorderListItems,
	useUpdateList,
} from "@/lib/use-lists";
import { useMediaCardColumns } from "@/lib/use-media-card-columns";
import { useRefreshActiveQueries } from "@/lib/use-refresh";
import { ShowProgressScope } from "@/lib/use-show-progress";
import { useTwStyle } from "@/lib/use-tw-style";
import { webListUrl } from "@/lib/web-url";
import { useThemeColors } from "@/theme/colors";

type MediaFilter = "all" | "movie" | "show" | "unwatched";

const FILTERS: { key: MediaFilter; label: string }[] = [
	{ key: "all", label: "All" },
	{ key: "movie", label: "Movies" },
	{ key: "show", label: "Shows" },
	{ key: "unwatched", label: "Unwatched" },
];

/** `${mediaType}:${mediaId}` key, collapsing season/episode entries onto the show. */
const itemKey = (item: MediaInListDto) =>
	`${item.mediaType === "movie" ? "movie" : "show"}:${item.mediaId}`;

function ListItemCard({
	item,
	onRemove,
}: {
	item: MediaInListDto;
	onRemove: (item: MediaInListDto) => void;
}) {
	return (
		<View className="flex-1">
			<MediaCard
				item={listItemToMediaCardItem(item)}
				actions
				watchCount={item.watchCount}
			/>
			{/* Top-LEFT: the card's own watched toggle owns the top-right corner;
			    stacking both there rendered the remove X on top of the gold check. */}
			<Pressable
				hitSlop={6}
				onPress={() => onRemove(item)}
				className="absolute top-1.5 left-1.5 size-7 items-center justify-center rounded-full bg-black/55"
			>
				<X color="#ffffff" size={16} strokeWidth={2.5} />
			</Pressable>
		</View>
	);
}

export default function ListDetailScreen() {
	const themeColors = useThemeColors();
	const { showDialog } = useDialog();
	const { slug, addInput, shortcutRequest } = useLocalSearchParams<{
		slug: string;
		addInput?: string;
		shortcutRequest?: string;
	}>();
	const router = useRouter();
	const gridStyle = useTwStyle("px-3 pt-3 pb-12");
	// Matches the read-only grid: the cells carry their own px-1 on top.
	const reorderStyle = useTwStyle("px-3 pt-3 pb-12");
	const numColumns = useMediaCardColumns();
	const { user, isAuthenticated } = useAuth();
	const toast = useToast();
	const { refreshing, onRefresh } = useRefreshActiveQueries();

	const [sort, setSort] = useState<ListSort>("position");

	const {
		list,
		items,
		isLoading,
		isError,
		isNotFound,
		refetch,
		isFetching,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useList(slug, sort);
	const updateList = useUpdateList();
	const deleteList = useDeleteList();
	const removeItem = useRemoveListItem(slug);
	const reorder = useReorderListItems(slug);

	const [editorVisible, setEditorVisible] = useState(false);
	const [addVisible, setAddVisible] = useState(false);
	useFocusEffect(useCallback(() => () => setAddVisible(false), []));
	useEffect(() => {
		if (slug === "watchlist" && shortcutRequest)
			setAddVisible(Boolean(addInput));
	}, [slug, addInput, shortcutRequest]);
	const [sortVisible, setSortVisible] = useState(false);
	const [filter, setFilter] = useState<MediaFilter>("all");
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebounce(search.trim(), 350);

	// Reorder mode holds its own working copy of the ordered items; committing
	// PUTs the full id list. Entering requires every page loaded, since the
	// endpoint wants the complete ordered id set.
	const [reorderMode, setReorderMode] = useState(false);
	const [preparingReorder, setPreparingReorder] = useState(false);
	const [orderedItems, setOrderedItems] = useState<MediaInListDto[]>([]);

	const filteredItems = useMemo(() => {
		const query = debouncedSearch.toLowerCase();
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
	}, [items, filter, debouncedSearch]);

	// Search filters client-side (matching the web list page), so eagerly load
	// the remaining pages while a query is active — otherwise matches on
	// unloaded pages stay invisible.
	useEffect(() => {
		if (debouncedSearch && hasNextPage && !isFetchingNextPage) {
			void fetchNextPage();
		}
	}, [debouncedSearch, hasNextPage, isFetchingNextPage, fetchNextPage]);

	const existingKeys = useMemo(() => new Set(items.map(itemKey)), [items]);

	// Prepare-reorder pump: fetch remaining pages, then enter reorder mode.
	useEffect(() => {
		if (!preparingReorder) return;
		if (hasNextPage) {
			if (!isFetchingNextPage) void fetchNextPage();
			return;
		}
		setOrderedItems(items);
		setReorderMode(true);
		setPreparingReorder(false);
	}, [preparingReorder, hasNextPage, isFetchingNextPage, fetchNextPage, items]);

	const handleRemove = (item: MediaInListDto) => {
		removeItem.mutate({
			path: { slug, mediaType: item.mediaType, mediaId: item.mediaId },
			query: {
				seasonNumber: item.seasonNumber,
				episodeNumber: item.episodeNumber,
			},
		});
	};

	const confirmDelete = () => {
		showDialog({
			title: "Delete list",
			description: `Delete “${list?.name ?? "this list"}”?`,
			actions: [
				{ label: "Cancel" },
				{
					label: "Delete",
					variant: "destructive",
					onPress: () =>
						deleteList.mutate(
							{ path: { slug } },
							{ onSuccess: () => router.back() },
						),
				},
			],
		});
	};

	const handleSaveEdit = (input: { name: string; description?: string }) => {
		updateList.mutate({ path: { slug }, body: input });
		setEditorVisible(false);
	};

	const handleShare = () => {
		if (!list || !user?.handle) return;
		Share.share({
			message: webListUrl(user.handle, list.slug),
			title: list.name,
		})
			.then((result) => {
				if (result.action === Share.sharedAction) {
					posthog?.capture("share_completed", { surface: "list_detail" });
				}
			})
			.catch(() => {});
	};

	const startReorder = () => {
		if (sort !== "position") {
			toast.show("Switch to Order sort to reorder", "error");
			return;
		}
		if (hasNextPage) {
			setPreparingReorder(true);
		} else {
			setOrderedItems(items);
			setReorderMode(true);
		}
	};

	const moveItem = (from: number, to: number) => {
		setOrderedItems((current) => {
			if (to < 0 || to >= current.length) return current;
			const next = [...current];
			const [moved] = next.splice(from, 1);
			next.splice(to, 0, moved);
			return next;
		});
	};

	const commitReorder = () => {
		reorder.mutate(
			{ path: { slug }, body: { ids: orderedItems.map((item) => item.id) } },
			{ onSuccess: () => setReorderMode(false) },
		);
	};

	// Back out of reorder mode; only bother confirming when the order changed.
	const cancelReorder = () => {
		if (reorder.isPending) return;
		const dirty =
			orderedItems.map((item) => item.id).join() !==
			items.map((item) => item.id).join();
		if (!dirty) {
			setReorderMode(false);
			return;
		}
		showDialog({
			title: "Discard changes?",
			description: "Your new order won't be saved.",
			actions: [
				{ label: "Keep editing" },
				{
					label: "Discard",
					variant: "destructive",
					onPress: () => setReorderMode(false),
				},
			],
		});
	};

	const canManage = list && !list.isDefault;
	const total = list?.total ?? 0;
	const showProgress = isAuthenticated && total > 0;

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{
					headerShown: true,
					title: reorderMode ? "Reorder" : (list?.name ?? "List"),
					headerRight:
						list && !reorderMode
							? () => (
									<View className="flex-row items-center gap-4">
										<Pressable hitSlop={8} onPress={handleShare}>
											<Share2 color={themeColors.mutedForeground} size={20} />
										</Pressable>
										<Pressable hitSlop={8} onPress={() => setAddVisible(true)}>
											<Plus color={themeColors.mutedForeground} size={22} />
										</Pressable>
										{canManage ? (
											<Pressable
												hitSlop={8}
												onPress={() => setEditorVisible(true)}
											>
												<Pencil color={themeColors.mutedForeground} size={20} />
											</Pressable>
										) : null}
										{canManage ? (
											<Pressable hitSlop={8} onPress={confirmDelete}>
												<Trash2 color={themeColors.destructive} size={20} />
											</Pressable>
										) : null}
									</View>
								)
							: reorderMode
								? () => (
										<Pressable
											hitSlop={8}
											onPress={commitReorder}
											disabled={reorder.isPending}
										>
											{reorder.isPending ? (
												<ActivityIndicator color={themeColors.accent} />
											) : (
												<Text className="font-semibold text-base text-primary">
													Done
												</Text>
											)}
										</Pressable>
									)
								: undefined,
					headerLeft: reorderMode
						? () => <HeaderBackButton onPress={cancelReorder} />
						: undefined,
				}}
			/>

			{/* React Query keeps the last data when a refetch fails, so the list
			    below is still worth showing. Replacing it with a full error state
			    threw away items the reader could still act on. */}
			{isError && list ? (
				<StaleDataNotice
					isRetrying={isFetching}
					message="Couldn't refresh this list. Showing what loaded last."
					onRetry={() => refetch()}
				/>
			) : null}

			{isLoading ? (
				<View className="px-3 pt-3">
					<PosterGridSkeleton columns={numColumns} />
				</View>
			) : isNotFound ? (
				// Same wording as Web: renaming a list regenerates its slug, so a
				// stale link is a missing list rather than a broken app.
				<EmptyState
					icon={ListIcon}
					title="List not found"
					message="This list doesn't exist, or it isn't public."
				/>
			) : !list ? (
				<ErrorState message="Couldn't load this list." />
			) : reorderMode ? (
				<ScrollView
					contentContainerStyle={reorderStyle}
					showsVerticalScrollIndicator={false}
				>
					<Text className="pb-3 text-muted-foreground text-sm">
						Hold a poster to drag it, or use the arrows, then tap Done to save.
					</Text>
					<ReorderableItemGrid
						items={orderedItems}
						columns={numColumns}
						onReorder={moveItem}
					/>
				</ScrollView>
			) : (
				<ShowProgressScope
					showIds={filteredItems
						.filter(
							(item) =>
								item.mediaType === "show" &&
								item.seasonNumber == null &&
								item.episodeNumber == null,
						)
						.map((item) => item.mediaId)}
				>
					<FlashList
						key={`grid-${numColumns}`}
						data={filteredItems}
						numColumns={numColumns}
						keyExtractor={(item) => item.id}
						renderItem={({ item }) => (
							<View className="flex-1 px-1 pb-3">
								<ListItemCard item={item} onRemove={handleRemove} />
							</View>
						)}
						contentContainerStyle={gridStyle}
						showsVerticalScrollIndicator={false}
						keyboardShouldPersistTaps="handled"
						refreshControl={
							<RefreshControl
								refreshing={refreshing}
								onRefresh={onRefresh}
								tintColor={themeColors.accent}
								colors={[themeColors.accent]}
							/>
						}
						onEndReachedThreshold={0.5}
						onEndReached={() => {
							if (hasNextPage && !isFetchingNextPage) fetchNextPage();
						}}
						ListHeaderComponent={
							<View className="gap-3 px-1 pb-4">
								<ListInfoCard {...list} showProgress={showProgress} isOwner />

								<TextField
									leading={
										<Search color={themeColors.mutedForeground} size={18} />
									}
									trailing={
										search.length > 0 ? (
											<Pressable hitSlop={8} onPress={() => setSearch("")}>
												<X color={themeColors.mutedForeground} size={18} />
											</Pressable>
										) : null
									}
									value={search}
									onChangeText={setSearch}
									placeholder="Search list…"
									autoCapitalize="none"
									autoCorrect={false}
								/>

								<View className="flex-row items-center justify-between">
									<Pressable
										onPress={() => setSortVisible(true)}
										className="flex-row items-center gap-1.5 rounded-full bg-background-subtle px-3 py-1.5"
									>
										<ArrowUpDown
											color={themeColors.mutedForeground}
											size={14}
										/>
										<Text className="font-medium text-muted-foreground text-sm">
											{sortLabel(sort)}
										</Text>
									</Pressable>

									{total > 1 ? (
										<Pressable
											onPress={startReorder}
											disabled={preparingReorder}
											className="flex-row items-center gap-1.5 rounded-full bg-background-subtle px-3 py-1.5"
										>
											{preparingReorder ? (
												<ActivityIndicator
													color={themeColors.mutedForeground}
													size="small"
												/>
											) : (
												<ListOrdered
													color={
														sort === "position"
															? themeColors.mutedForeground
															: themeColors.mutedForeground
													}
													size={14}
												/>
											)}
											<Text
												className={cn(
													"font-medium text-sm",
													sort === "position"
														? "text-muted-foreground"
														: "text-muted-foreground/50",
												)}
											>
												Reorder
											</Text>
										</Pressable>
									) : null}
								</View>

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
							</View>
						}
						ListEmptyComponent={
							debouncedSearch || filter !== "all" ? (
								<EmptyState
									title="No matches"
									message="Try a different search or filter."
								/>
							) : (
								<EmptyState
									title="Empty list"
									message="Add movies and shows with the + button or from their detail screens."
								/>
							)
						}
						ListFooterComponent={
							// Card-shaped placeholders, not a spinner, while more load.
							isFetchingNextPage ? (
								<View className="px-3 pt-2">
									<PosterGridSkeleton rows={1} columns={numColumns} />
								</View>
							) : null
						}
					/>
				</ShowProgressScope>
			)}

			<ListSortSheet
				visible={sortVisible}
				onDismiss={() => setSortVisible(false)}
				value={sort}
				onChange={setSort}
			/>

			<AddItemsToListSheet
				key={shortcutRequest ?? "manual"}
				initialInput={slug === "watchlist" ? addInput : undefined}
				confirmBeforeAdd={slug === "watchlist" && !!addInput}
				visible={addVisible}
				onDismiss={() => {
					setAddVisible(false);
					router.setParams({ addInput: undefined, shortcutRequest: undefined });
				}}
				slug={slug}
				existingKeys={existingKeys}
			/>

			<ListEditorSheet
				visible={editorVisible}
				onDismiss={() => setEditorVisible(false)}
				isEditing
				initialName={list?.name ?? ""}
				initialDescription={list?.description ?? ""}
				onSave={handleSaveEdit}
				isSaving={updateList.isPending}
			/>
		</View>
	);
}
