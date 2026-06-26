import { Check, Disc, X } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
import { LIBRARY_FORMATS, type LibraryFormat } from "@/lib/use-library";

/**
 * Bottom sheet to mark which Formats the user owns an item in. Mirrors
 * AddToListSheet, but the axis is Format and there's an optional box-set field
 * applied to formats added while it's filled.
 */
export function AddToLibrarySheet({
	visible,
	onDismiss,
	ownedFormats,
	isLoading,
	onToggle,
}: {
	visible: boolean;
	onDismiss: () => void;
	ownedFormats: Set<LibraryFormat>;
	isLoading?: boolean;
	onToggle: (format: LibraryFormat, boxSet?: string) => void;
}) {
	const [boxSet, setBoxSet] = useState("");

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent
			onRequestClose={onDismiss}
		>
			<View className="flex-1 justify-end">
				<Pressable className="flex-1" onPress={onDismiss} />
				<View className="max-h-[80%] gap-3 rounded-t-2xl border border-border bg-card p-5">
					<View className="flex-row items-center justify-between">
						<Text className="font-bold font-display text-foreground text-lg">
							Add to library
						</Text>
						<Pressable hitSlop={8} onPress={onDismiss}>
							<X color="#94a3b8" size={22} />
						</Pressable>
					</View>

					<TextField
						label="Box set (optional)"
						placeholder="e.g. The Lord of the Rings Trilogy"
						value={boxSet}
						onChangeText={setBoxSet}
					/>

					{isLoading ? (
						<Text className="py-4 text-muted-foreground text-sm">Loading…</Text>
					) : (
						<ScrollView showsVerticalScrollIndicator={false}>
							<View className="gap-2">
								{LIBRARY_FORMATS.map(({ value, label }) => {
									const isOwned = ownedFormats.has(value);
									return (
										<Pressable
											key={value}
											onPress={() => onToggle(value, boxSet)}
											className="flex-row items-center gap-3 rounded-lg border border-border p-3"
										>
											<View
												className={cn(
													"size-6 items-center justify-center rounded-md border",
													isOwned
														? "border-primary bg-primary"
														: "border-border",
												)}
											>
												{isOwned ? (
													<Check color="#3f2e00" size={16} strokeWidth={3} />
												) : null}
											</View>
											<Disc color="#94a3b8" size={18} />
											<Text className="flex-1 font-medium text-foreground text-sm">
												{label}
											</Text>
										</Pressable>
									);
								})}
							</View>
						</ScrollView>
					)}
				</View>
			</View>
		</Modal>
	);
}
