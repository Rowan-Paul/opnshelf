import type { ListsForItemDto } from "@opnshelf/api";
import { Check, X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { ListRowsSkeleton } from "@/components/ui/skeletons";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

/**
 * Bottom sheet listing the user's lists with membership checkmarks for one
 * media item. Tapping a row toggles the item in/out of that list (optimistic,
 * handled by the parent's `useListMembership`).
 */
export function AddToListSheet({
	visible,
	onDismiss,
	memberships,
	isLoading,
	onToggle,
}: {
	visible: boolean;
	onDismiss: () => void;
	memberships: ListsForItemDto[];
	isLoading?: boolean;
	onToggle: (slug: string, isInList: boolean) => void;
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
				<View className="max-h-[70%] gap-3 rounded-t-2xl border border-border bg-card p-5">
					<View className="flex-row items-center justify-between">
						<Text className="font-bold font-display text-foreground text-lg">
							Add to list
						</Text>
						<Pressable hitSlop={8} onPress={onDismiss}>
							<X color="#94a3b8" size={22} />
						</Pressable>
					</View>

					{isLoading ? (
						<ListRowsSkeleton rows={2} />
					) : memberships.length === 0 ? (
						<Text className="py-4 text-muted-foreground text-sm">
							You have no lists yet. Create one from the Lists screen.
						</Text>
					) : (
						<ScrollView showsVerticalScrollIndicator={false}>
							<View className="gap-2">
								{memberships.map((list) => (
									<Pressable
										key={list.listSlug}
										onPress={() => onToggle(list.listSlug, list.isInList)}
										className="flex-row items-center gap-3 rounded-lg border border-border p-3"
									>
										<View
											className={cn(
												"size-6 items-center justify-center rounded-md border",
												list.isInList
													? "border-primary bg-primary"
													: "border-border",
											)}
										>
											{list.isInList ? (
												<Check color="#3f2e00" size={16} strokeWidth={3} />
											) : null}
										</View>
										<Text
											className="flex-1 font-medium text-foreground text-sm"
											numberOfLines={1}
										>
											{list.listName}
										</Text>
									</Pressable>
								))}
							</View>
						</ScrollView>
					)}
				</View>
			</View>
		</Modal>
	);
}
