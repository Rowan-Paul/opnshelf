import type { MediaInListDto } from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pencil, Trash2, X } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { ListEditorSheet } from "@/components/lists/ListEditorSheet";
import { MediaCard } from "@/components/media/MediaCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { listItemToMediaCardItem } from "@/lib/list-media";
import {
	useDeleteList,
	useList,
	useRemoveListItem,
	useUpdateList,
} from "@/lib/use-lists";
import { useTwStyle } from "@/lib/use-tw-style";

function ListItemCard({
	item,
	onRemove,
}: {
	item: MediaInListDto;
	onRemove: (item: MediaInListDto) => void;
}) {
	return (
		<View className="flex-1">
			<MediaCard item={listItemToMediaCardItem(item)} actions />
			<Pressable
				hitSlop={6}
				onPress={() => onRemove(item)}
				className="absolute top-1.5 right-1.5 size-7 items-center justify-center rounded-full bg-black/55"
			>
				<X color="#ffffff" size={16} strokeWidth={2.5} />
			</Pressable>
		</View>
	);
}

export default function ListDetailScreen() {
	const { slug } = useLocalSearchParams<{ slug: string }>();
	const router = useRouter();
	const gridStyle = useTwStyle("px-3 pb-12");

	const {
		list,
		items,
		isLoading,
		isError,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	} = useList(slug);
	const updateList = useUpdateList();
	const deleteList = useDeleteList();
	const removeItem = useRemoveListItem(slug);

	const [editorVisible, setEditorVisible] = useState(false);

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
		Alert.alert("Delete list", `Delete “${list?.name ?? "this list"}”?`, [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Delete",
				style: "destructive",
				onPress: () =>
					deleteList.mutate(
						{ path: { slug } },
						{ onSuccess: () => router.back() },
					),
			},
		]);
	};

	const handleSaveEdit = (input: { name: string; description?: string }) => {
		updateList.mutate({ path: { slug }, body: input });
		setEditorVisible(false);
	};

	const canManage = list && !list.isDefault;

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{ headerShown: true, title: list?.name ?? "List" }}
			/>

			{isLoading ? (
				<LoadingState />
			) : isError || !list ? (
				<ErrorState message="Couldn't load this list." />
			) : (
				<FlashList
					data={items}
					numColumns={3}
					keyExtractor={(item) => item.id}
					renderItem={({ item }) => (
						<View className="flex-1 px-1 pb-3">
							<ListItemCard item={item} onRemove={handleRemove} />
						</View>
					)}
					contentContainerStyle={gridStyle}
					showsVerticalScrollIndicator={false}
					onEndReachedThreshold={0.5}
					onEndReached={() => {
						if (hasNextPage && !isFetchingNextPage) fetchNextPage();
					}}
					ListHeaderComponent={
						<View className="gap-3 px-1 pb-4">
							{list.description ? (
								<Text className="text-muted-foreground text-sm leading-5">
									{list.description}
								</Text>
							) : null}
							<Text className="text-muted-foreground text-xs">
								{list.total} item{list.total === 1 ? "" : "s"}
							</Text>
							{canManage ? (
								<View className="flex-row gap-2">
									<Pressable
										onPress={() => setEditorVisible(true)}
										className="flex-row items-center gap-1.5 rounded-lg border border-border px-3 py-1.5"
									>
										<Pencil color="#94a3b8" size={16} />
										<Text className="font-medium text-foreground text-sm">
											Edit
										</Text>
									</Pressable>
									<Pressable
										onPress={confirmDelete}
										className="flex-row items-center gap-1.5 rounded-lg border border-destructive px-3 py-1.5"
									>
										<Trash2 color="#ef4444" size={16} />
										<Text className="font-medium text-destructive text-sm">
											Delete
										</Text>
									</Pressable>
								</View>
							) : null}
						</View>
					}
					ListEmptyComponent={
						<EmptyState
							title="Empty list"
							message="Add movies and shows from their detail screens."
						/>
					}
					ListFooterComponent={
						isFetchingNextPage ? (
							<View className="py-6">
								<ActivityIndicator color="#94a3b8" />
							</View>
						) : null
					}
				/>
			)}

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
