import type { ListSummaryDto } from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { Link, Stack } from "expo-router";
import { ChevronRight, ListPlus, Plus } from "lucide-react-native";
import { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { ListEditorSheet } from "@/components/lists/ListEditorSheet";
import { ListRowsSkeleton } from "@/components/ui/skeletons";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useCreateList, useUserLists } from "@/lib/use-lists";
import { useTwStyle } from "@/lib/use-tw-style";

function ListRow({ list }: { list: ListSummaryDto }) {
	return (
		<Link href={`/lists/${list.slug}` as const} asChild>
			<Pressable className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4">
				<View className="min-w-0 flex-1">
					<Text
						className="font-semibold text-base text-foreground"
						numberOfLines={1}
					>
						{list.name}
					</Text>
					{list.description ? (
						<Text className="text-muted-foreground text-sm" numberOfLines={1}>
							{list.description}
						</Text>
					) : null}
					<Text className="mt-0.5 text-muted-foreground text-xs">
						{list.itemCount} item{list.itemCount === 1 ? "" : "s"}
					</Text>
				</View>
				<ChevronRight color="#94a3b8" size={18} />
			</Pressable>
		</Link>
	);
}

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

	const handleCreate = (input: { name: string; description?: string }) => {
		createList.mutate({ body: input });
		setEditorVisible(false);
	};

	function renderBody() {
		if (isLoading) return <ListRowsSkeleton rows={3} />;
		if (isError) return <ErrorState message="Couldn't load your lists." />;
		if (!lists || lists.length === 0) {
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
				data={lists}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => (
					<View className="pb-2">
						<ListRow list={item} />
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
			<View className="flex-1 pt-2">{renderBody()}</View>

			<ListEditorSheet
				visible={editorVisible}
				onDismiss={() => setEditorVisible(false)}
				onSave={handleCreate}
				isSaving={createList.isPending}
			/>
		</View>
	);
}
