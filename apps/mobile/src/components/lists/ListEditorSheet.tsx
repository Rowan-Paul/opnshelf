import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import {
	KeyboardAvoidingView,
	KeyboardProvider,
} from "react-native-keyboard-controller";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useTwStyle } from "@/lib/use-tw-style";

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
	// KeyboardAvoidingView is third-party, so resolve its layout classes to a
	// style object (Uniwind className only works on RN-core components).
	const avoidingStyle = useTwStyle("flex-1 justify-end");

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
			{/*
				RN <Modal> renders in a separate window outside the root
				KeyboardProvider (notably on Android), so it needs its own provider
				to receive keyboard events and lift this bottom-anchored sheet.
			*/}
			<KeyboardProvider>
				<KeyboardAvoidingView behavior="padding" style={avoidingStyle}>
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

						<TextField
							variant="subtle"
							value={name}
							onChangeText={setName}
							placeholder="List name"
							maxLength={200}
						/>

						<TextField
							variant="subtle"
							multiline
							className="min-h-24"
							value={description}
							onChangeText={setDescription}
							placeholder="Description (optional)"
							maxLength={2000}
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
			</KeyboardProvider>
		</Modal>
	);
}
