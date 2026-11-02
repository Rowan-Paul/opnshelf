import { Check, X } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { BottomSheetModal } from "@/components/ui/bottom-sheet-modal";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import type { ListSort } from "@/lib/use-lists";
import { useThemeColors } from "@/theme/colors";

export const SORT_OPTIONS: { key: ListSort; label: string }[] = [
	{ key: "position", label: "Order" },
	{ key: "added", label: "Recently added" },
	{ key: "title", label: "Title (A–Z)" },
	{ key: "year", label: "Release year" },
];

export function sortLabel(sort: ListSort): string {
	return SORT_OPTIONS.find((o) => o.key === sort)?.label ?? "Order";
}

/** Small bottom sheet for picking the list item sort order. */
export function ListSortSheet({
	visible,
	onDismiss,
	value,
	onChange,
}: {
	visible: boolean;
	onDismiss: () => void;
	value: ListSort;
	onChange: (sort: ListSort) => void;
}) {
	const colors = useThemeColors();
	return (
		<BottomSheetModal visible={visible} onRequestClose={onDismiss}>
			<View className="flex-1 justify-end">
				<Pressable className="flex-1" onPress={onDismiss} />
				<View className="gap-3 rounded-t-2xl border border-border bg-card p-5">
					<View className="flex-row items-center justify-between">
						<Text className="font-display-bold text-foreground text-lg">
							Sort by
						</Text>
						<Pressable hitSlop={8} onPress={onDismiss}>
							<X color={colors.mutedForeground} size={22} />
						</Pressable>
					</View>

					<View className="gap-2">
						{SORT_OPTIONS.map((option) => {
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
										<Check color={colors.accent} size={18} strokeWidth={3} />
									) : null}
								</Pressable>
							);
						})}
					</View>
				</View>
			</View>
		</BottomSheetModal>
	);
}
