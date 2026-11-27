import {
	isListItemNoteTooLong,
	type MediaInListDto,
	privacyControllerStatusOptions,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import {
	Stack,
	useFocusEffect,
	useLocalSearchParams,
	useRouter,
} from "expo-router";
import {
	List as ListIcon,
	ListOrdered,
	Pencil,
	Plus,
	Share2,
	Trash2,
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
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { HeaderBackButton } from "@/components/AppHeader";
import { AddItemsToListSheet } from "@/components/lists/AddItemsToListSheet";
import { ListEditorSheet } from "@/components/lists/ListEditorSheet";
import { ListInfoCard } from "@/components/lists/ListInfoCard";
import { getItemLabel, ListItemCard } from "@/components/lists/ListItemCard";
import {
	LIST_EMPTY_OWNER_MESSAGE,
	LIST_EMPTY_TITLE,
	LIST_NO_MATCHES_MESSAGE,
	LIST_NO_MATCHES_TITLE,
	ListItemsToolbar,
	useListItemsFilter,
} from "@/components/lists/ListItemsToolbar";
import { ListSortSheet } from "@/components/lists/ListSortSheet";
import { ReorderableItemGrid } from "@/components/lists/ReorderableItemGrid";

import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/dialog";
import { KeyboardSheetModal } from "@/components/ui/keyboard-sheet-modal";
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

import { posthog } from "@/lib/posthog";
import {
	type ListSort,
	useDeleteList,
	useList,
	useRemoveListItem,
	useReorderListItems,
	useUpdateList,
	useUpdateListItemNote,
} from "@/lib/use-lists";
import { useMediaCardColumns } from "@/lib/use-media-card-columns";
import { useRefreshActiveQueries } from "@/lib/use-refresh";
import { ShowProgressScope } from "@/lib/use-show-progress";
import { useTwStyle } from "@/lib/use-tw-style";
import { webListUrl } from "@/lib/web-url";
import { useThemeColors } from "@/theme/colors";

/** `${mediaType}:${mediaId}` key, collapsing season/episode entries onto the show. */
const itemKey = (item: MediaInListDto) =>
	`${item.mediaType === "movie" ? "movie" : "show"}:${item.mediaId}`;

/** The signed-in user's own List: reorder, add, edit and delete. */
export function OwnListScreen() {
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
	const noteMutation = useUpdateListItemNote();
	const [noteEditor, setNoteEditor] = useState<{
		item: MediaInListDto;
		text: string;
	} | null>(null);
	const { data: privacyStatus } = useQuery({
		...privacyControllerStatusOptions(),
		enabled: noteEditor !== null && !!list?.rkey,
	});
	const noteScope = privacyStatus?.scopes?.find(
		(scope) => scope.category === "lists" && scope.listRkey === list?.rkey,
	);
	const noteVisibility = noteScope?.migration
		? undefined
		: noteScope?.visibility;
	const noteTooLong =
		noteEditor !== null && isListItemNoteTooLong(noteEditor.text);
	const [noteAction, setNoteAction] = useState<"save" | "remove">("save");
	const removingNote = noteMutation.isPending && noteAction === "remove";
	const noteSheetStyle = useTwStyle("flex-1 justify-end");
	const closeNoteEditor = () => {
		if (!noteMutation.isPending) setNoteEditor(null);
	};
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
	const { filter, setFilter, search, setSearch, filteredItems, isFiltered } =
		useListItemsFilter(items, {
			hasNextPage,
			isFetchingNextPage,
			fetchNextPage,
		});

	// Reorder mode holds its own working copy of the ordered items; committing
	// PUTs the full id list. Entering requires every page loaded, since the
	// endpoint wants the complete ordered id set.
	const [reorderMode, setReorderMode] = useState(false);
	const [preparingReorder, setPreparingReorder] = useState(false);
	const [orderedItems, setOrderedItems] = useState<MediaInListDto[]>([]);

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
												<Text className="font-semibold text-accent-text text-base">
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
								<ListItemCard
									item={item}
									onRemove={handleRemove}
									onEditNote={() =>
										setNoteEditor({ item, text: item.notes ?? "" })
									}
								/>
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

								<ListItemsToolbar
									search={search}
									onSearchChange={setSearch}
									sort={sort}
									onSortPress={() => setSortVisible(true)}
									filter={filter}
									onFilterChange={setFilter}
									trailing={
										total > 1 ? (
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
														color={themeColors.mutedForeground}
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
										) : null
									}
								/>
							</View>
						}
						ListEmptyComponent={
							isFiltered ? (
								<EmptyState
									title={LIST_NO_MATCHES_TITLE}
									message={LIST_NO_MATCHES_MESSAGE}
								/>
							) : (
								<EmptyState
									icon={ListIcon}
									title={LIST_EMPTY_TITLE}
									message={LIST_EMPTY_OWNER_MESSAGE}
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

			<KeyboardSheetModal
				visible={noteEditor !== null}
				onRequestClose={closeNoteEditor}
			>
				{noteEditor && (
					<KeyboardAvoidingView behavior="padding" style={noteSheetStyle}>
						<Pressable
							className="flex-1"
							onPress={closeNoteEditor}
							accessible={false}
						/>
						<View className="gap-4 rounded-t-2xl border border-border bg-card p-5">
							<Text className="font-display-bold text-lg">List item note</Text>
							<Text>{getItemLabel(noteEditor.item)}</Text>
							<TextField
								variant="subtle"
								multiline
								className="min-h-24"
								accessibilityLabel="Note"
								editable={!noteMutation.isPending}
								value={noteEditor.text}
								onChangeText={(text) => setNoteEditor({ ...noteEditor, text })}
							/>
							<Text className="text-muted-foreground text-sm">
								{noteVisibility === "private"
									? "Only you can read this note because this List is private."
									: noteVisibility === "public"
										? "Anyone who can view this List can read this note."
										: "This note follows the List’s visibility."}
							</Text>
							{noteTooLong && (
								<Text accessibilityLiveRegion="polite" className="text-sm">
									Use 1,000 characters or fewer.
								</Text>
							)}
							<Button
								disabled={noteTooLong || removingNote}
								label="Save note"
								loadingLabel="Saving…"
								loading={noteMutation.isPending && !removingNote}
								onPress={() => {
									setNoteAction("save");
									noteMutation.mutate(
										{
											path: { slug, itemId: noteEditor.item.id },
											body: { notes: noteEditor.text },
										},
										{ onSuccess: () => setNoteEditor(null) },
									);
								}}
							/>
							{noteEditor.item.notes && (
								<Button
									label="Remove note"
									loadingLabel="Removing…"
									variant="secondary"
									disabled={noteMutation.isPending}
									loading={removingNote}
									onPress={() => {
										setNoteAction("remove");
										noteMutation.mutate(
											{
												path: { slug, itemId: noteEditor.item.id },
												body: { notes: "" },
											},
											{ onSuccess: () => setNoteEditor(null) },
										);
									}}
								/>
							)}
							<Button
								label="Cancel"
								variant="ghost"
								disabled={noteMutation.isPending}
								onPress={closeNoteEditor}
							/>
						</View>
					</KeyboardAvoidingView>
				)}
			</KeyboardSheetModal>

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
