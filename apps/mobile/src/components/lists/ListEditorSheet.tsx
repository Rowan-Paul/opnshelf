import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	TextInput,
	View,
} from "react-native";
import { Text } from "@/components/ui/text";

interface ListEditorSheetProps {
	visible: boolean;
	onDismiss: () => void;
	isEditing?: boolean;
	initialName?: string;
	initialDescription?: string;
	onSave: (input: { name: string; description?: string }) => void;
	isSaving?: boolean;
}

/**
 * Bottom sheet for creating or editing a list (name + optional description).
 * Sibling of the review/note editor sheets. A list requires a name.
 */
export function ListEditorSheet({
	visible,
	onDismiss,
	isEditing = false,
	initialName = "",
	initialDescription = "",
	onSave,
	isSaving = false,
}: ListEditorSheetProps) {
	const [name, setName] = useState(initialName);
	const [description, setDescription] = useState(initialDescription);

	useEffect(() => {
		if (visible) {
			setName(initialName);
			setDescription(initialDescription);
		}
	}, [visible, initialName, initialDescription]);

	const canSave = name.trim().length > 0 && !isSaving;

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent
			onRequestClose={onDismiss}
		>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				className="flex-1 justify-end"
			>
				<Pressable className="flex-1" onPress={onDismiss} />
				<View className="gap-4 rounded-t-2xl border border-border bg-card p-5">
					<View className="flex-row items-center justify-between">
						<Text className="font-bold font-display text-foreground text-lg">
							{isEditing ? "Edit list" : "New list"}
						</Text>
						<Pressable hitSlop={8} onPress={onDismiss}>
							<X color="#94a3b8" size={22} />
						</Pressable>
					</View>

					<TextInput
						value={name}
						onChangeText={setName}
						placeholder="List name"
						placeholderTextColor="#94a3b8"
						maxLength={200}
						className="rounded-lg border border-border bg-background-subtle p-3 font-sans text-base text-foreground"
					/>

					<TextInput
						value={description}
						onChangeText={setDescription}
						placeholder="Description (optional)"
						placeholderTextColor="#94a3b8"
						multiline
						textAlignVertical="top"
						maxLength={2000}
						className="min-h-24 rounded-lg border border-border bg-background-subtle p-3 font-sans text-base text-foreground"
					/>

					<Pressable
						onPress={() =>
							onSave({
								name: name.trim(),
								description: description.trim() || undefined,
							})
						}
						disabled={!canSave}
						className="items-center rounded-lg bg-primary py-3"
						style={{ opacity: canSave ? 1 : 0.5 }}
					>
						<Text className="font-semibold text-primary-foreground">
							{isSaving
								? "Saving…"
								: isEditing
									? "Save changes"
									: "Create list"}
						</Text>
					</Pressable>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}
