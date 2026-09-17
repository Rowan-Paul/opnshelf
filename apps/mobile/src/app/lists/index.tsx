import type { ListSummaryDto } from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { Stack } from "expo-router";
import { ListPlus, Plus } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { ListEditorSheet } from "@/components/lists/ListEditorSheet";
import { ListSummaryRow } from "@/components/lists/ListSummaryRow";
import {
	ListsSortButton,
	ListsSortSheet,
} from "@/components/lists/ListsSortSheet";
import { ListSummaryRowsSkeleton } from "@/components/ui/skeletons";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { type ListsSort, sortLists } from "@/lib/lists-sort";
import { useCreateList, useUserLists } from "@/lib/use-lists";
import { useTwStyle } from "@/lib/use-tw-style";

export default function ListsScreen() {
	const listStyle = useTwStyle("px-4 pb-8");
	const {
		data: lists,
		isLoading,
		isError,
		isRefetching,
		refetch,
	} = useUserLists();
	const createList = useCreateList();
	const [editorVisible, setEditorVisible] = useState(false);
	const [sort, setSort] = useState<ListsSort>("default");
	const [sortSheetVisible, setSortSheetVisible] = useState(false);

	const sorted = useMemo(
		() => (lists ? sortLists(lists, sort) : undefined),
		[lists, sort],
	);

	const handleCreate = (input: { name: string; description?: string }) => {
		createList.mutate({ body: input });
		setEditorVisible(false);
	};

	function renderBody() {
		if (isLoading) return <ListSummaryRowsSkeleton rows={3} />;
		if (isError) return <ErrorState message="Couldn't load your lists." />;
		if (!sorted || sorted.length === 0) {
			return (
				<EmptyState
					icon={ListPlus}
					title="No lists yet"
					message="Create a list to start organizing movies and shows."
				/>
			);
		}
		return (
			<FlashList
				// Remount when the sort changes. FlashList recycles cells against
				// the previous layout, and reordering the same data made it stack
				// two rows at one offset — a list silently disappeared. Sorting is
				// a deliberate, occasional action, so a remount is cheap and exact.
				key={sort}
				data={sorted}
				extraData={sort}
				keyExtractor={(item: ListSummaryDto) => item.id}
				renderItem={({ item }: { item: ListSummaryDto }) => (
					<View className="pb-2">
						<ListSummaryRow list={item} href={`/lists/${item.slug}` as const} />
					</View>
				)}
				contentContainerStyle={listStyle}
				showsVerticalScrollIndicator={false}
				refreshControl={
					<RefreshControl
						refreshing={isRefetching}
						onRefresh={() => {
							void refetch();
						}}
						tintColor="#f3bc00"
						colors={["#f3bc00"]}
					/>
				}
			/>
		);
	}

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{
					headerShown: true,
					title: "Lists",
					headerRight: () => (
						<Pressable hitSlop={8} onPress={() => setEditorVisible(true)}>
							<Plus color="#94a3b8" size={22} />
						</Pressable>
					),
				}}
			/>
			{lists && lists.length > 1 ? (
				<View className="px-4 pt-3 pb-1">
					<ListsSortButton
						sort={sort}
						onPress={() => setSortSheetVisible(true)}
					/>
				</View>
			) : null}
			<View className="flex-1 pt-2">{renderBody()}</View>

			<ListsSortSheet
				visible={sortSheetVisible}
				onDismiss={() => setSortSheetVisible(false)}
				value={sort}
				onChange={setSort}
			/>

			<ListEditorSheet
				visible={editorVisible}
				onDismiss={() => setEditorVisible(false)}
				onSave={handleCreate}
				isSaving={createList.isPending}
			/>
		</View>
	);
}
