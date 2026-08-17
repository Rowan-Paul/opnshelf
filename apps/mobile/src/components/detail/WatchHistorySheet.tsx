import { Plus, X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Text } from "@/components/ui/text";
import { formatWatchDateTime } from "@/lib/watch-date";

export interface WatchHistoryEntry {
	id: string;
	watchedDate?: string;
}

/**
 * Bottom sheet listing every logged watch for a movie or episode, each with a
 * delete control, plus an "Add a watch" action. Mirrors the web "Your Activity"
 * card — lets users manage individual plays (re-watches) rather than the binary
 * on/off-shelf toggle. The parent owns the data + mutations; adding a dated
 * watch defers to the parent's date picker via `onAddWatch`.
 */
export function WatchHistorySheet({
	visible,
	onDismiss,
	title,
	entries,
	onDelete,
	isDeleting,
	onAddWatch,
}: {
	visible: boolean;
	onDismiss: () => void;
	title?: string;
	entries: WatchHistoryEntry[];
	onDelete: (id: string) => void;
	isDeleting?: boolean;
	onAddWatch: () => void;
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
						<View className="min-w-0 flex-1">
							<Text className="font-bold font-display text-foreground text-lg">
								Watch history
							</Text>
							{title ? (
								<Text
									className="text-muted-foreground text-sm"
									numberOfLines={1}
								>
									{title}
								</Text>
							) : null}
						</View>
						<Pressable hitSlop={8} onPress={onDismiss}>
							<X color="#94a3b8" size={22} />
						</Pressable>
					</View>

					{entries.length === 0 ? (
						<View className="items-center rounded-lg border border-border bg-background-subtle p-6">
							<Text className="text-muted-foreground text-sm">
								No watches logged yet.
							</Text>
						</View>
					) : (
						<ScrollView
							className="max-h-80"
							showsVerticalScrollIndicator={false}
						>
							<View className="gap-1">
								{entries.map((entry) => (
									<View
										key={entry.id}
										className="flex-row items-center gap-2 rounded-lg p-2"
									>
										<Text className="flex-1 font-medium text-foreground text-sm">
											{formatWatchDateTime(entry.watchedDate) ?? "Unknown date"}
										</Text>
										<Pressable
											hitSlop={8}
											onPress={() => onDelete(entry.id)}
											disabled={isDeleting}
											className="size-8 items-center justify-center rounded-md"
											style={{ opacity: isDeleting ? 0.5 : 1 }}
										>
											<X color="#ef4444" size={18} />
										</Pressable>
									</View>
								))}
							</View>
						</ScrollView>
					)}

					<Pressable
						onPress={onAddWatch}
						className="flex-row items-center justify-center gap-2 rounded-lg border border-border py-3"
					>
						<Plus color="#94a3b8" size={18} />
						<Text className="font-semibold text-foreground">Add a watch</Text>
					</Pressable>
				</View>
			</View>
		</Modal>
	);
}
