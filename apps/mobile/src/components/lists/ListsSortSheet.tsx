import { ArrowUpDown, Check, X } from "lucide-react-native";
import { Modal, Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import {
	LISTS_SORT_OPTIONS,
	type ListsSort,
	listsSortLabel,
} from "@/lib/lists-sort";

/** The pill that opens the sheet. Hidden by callers when there is nothing to sort. */
export function ListsSortButton({
	sort,
	onPress,
}: {
	sort: ListsSort;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			className="flex-row items-center gap-1.5 self-start rounded-full bg-background-subtle px-3 py-1.5"
		>
			<ArrowUpDown color="#94a3b8" size={14} />
			<Text className="font-medium text-muted-foreground text-sm">
				{listsSortLabel(sort)}
			</Text>
		</Pressable>
	);
}

export function ListsSortSheet({
	visible,
	onDismiss,
	value,
	onChange,
}: {
	visible: boolean;
	onDismiss: () => void;
	value: ListsSort;
	onChange: (sort: ListsSort) => void;
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
							Sort lists
						</Text>
						<Pressable hitSlop={8} onPress={onDismiss}>
							<X color="#94a3b8" size={22} />
						</Pressable>
					</View>

					<View className="gap-2">
						{LISTS_SORT_OPTIONS.map((option) => {
							const isActive = value === option.key;
							return (
								<Pressable
									key={option.key}
									onPress={() => {
										onChange(option.key);
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
