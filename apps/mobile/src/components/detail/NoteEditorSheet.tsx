import { Trash2, X } from "lucide-react-native";
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

interface NoteEditorSheetProps {
	visible: boolean;
	onDismiss: () => void;
	/** Existing note content when editing; empty when writing a new one. */
	initialContent?: string;
	/** Whether the sheet is editing an existing note (vs. writing a new one). */
	isEditing?: boolean;
	onSave: (content: string) => void;
	/** Provided only when editing — deletes the note being edited. */
	onDelete?: () => void;
	isSaving?: boolean;
	isDeleting?: boolean;
}

/**
 * Bottom-anchored modal for writing or editing the single freeform note on a
 * media item. Sibling of `ReviewEditorSheet`, but a note is content-only (no
 * title) and one-per-item. `TextInput`/`Modal` are RN-core so `className`
 * works directly.
 */
export function NoteEditorSheet({
	visible,
	onDismiss,
	initialContent = "",
	isEditing = false,
	onSave,
	onDelete,
	isSaving = false,
	isDeleting = false,
}: NoteEditorSheetProps) {
	const [content, setContent] = useState(initialContent);

	// Re-sync local state whenever the sheet is (re)opened for a target.
	useEffect(() => {
		if (visible) setContent(initialContent);
	}, [visible, initialContent]);

	const canSave = content.trim().length > 0 && !isSaving;

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
							{isEditing ? "Edit note" : "Add a note"}
						</Text>
						<Pressable hitSlop={8} onPress={onDismiss}>
							<X color="#94a3b8" size={22} />
						</Pressable>
					</View>

					<TextInput
						value={content}
						onChangeText={setContent}
						placeholder="Your thoughts about this title…"
						placeholderTextColor="#94a3b8"
						multiline
						textAlignVertical="top"
						maxLength={20000}
						className="min-h-36 rounded-lg border border-border bg-background-subtle p-3 font-sans text-base text-foreground"
					/>

					{isEditing && onDelete ? (
						<Pressable
							onPress={onDelete}
							disabled={isDeleting}
							className="flex-row items-center justify-center gap-2 rounded-lg border border-destructive px-4 py-3"
							style={{ opacity: isDeleting ? 0.6 : 1 }}
						>
							<Trash2 color="#ef4444" size={18} />
							<Text className="font-semibold text-destructive">
								Delete note
							</Text>
						</Pressable>
					) : null}

					<Pressable
						onPress={() => onSave(content)}
						disabled={!canSave}
						className="items-center rounded-lg bg-primary py-3"
						style={{ opacity: canSave ? 1 : 0.5 }}
					>
						<Text className="font-semibold text-primary-foreground">
							{isSaving ? "Saving…" : "Save"}
						</Text>
					</Pressable>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}
