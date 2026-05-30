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

interface ReviewEditorSheetProps {
	visible: boolean;
	onDismiss: () => void;
	/** Existing review title and body when editing; empty when writing a new one. */
	initialTitle?: string;
	initialMarkdown?: string;
	/** Whether the sheet is editing an existing review (vs. writing a new one). */
	isEditing?: boolean;
	onSave: (input: { title: string; markdown: string }) => void;
	/** Provided only when editing — deletes the review being edited. */
	onDelete?: () => void;
	isSaving?: boolean;
	isDeleting?: boolean;
}

/**
 * Bottom-anchored modal for writing or editing a single long-form review. The
 * star rating is a separate one-per-media entity handled elsewhere; this sheet
 * is review-only. A review requires both a title and a markdown body.
 * `TextInput` and `Modal` are RN-core so `className` works directly.
 */
export function ReviewEditorSheet({
	visible,
	onDismiss,
	initialTitle = "",
	initialMarkdown = "",
	isEditing = false,
	onSave,
	onDelete,
	isSaving = false,
	isDeleting = false,
}: ReviewEditorSheetProps) {
	const [title, setTitle] = useState(initialTitle);
	const [markdown, setMarkdown] = useState(initialMarkdown);

	// Re-sync local state whenever the sheet is (re)opened for a target.
	useEffect(() => {
		if (visible) {
			setTitle(initialTitle);
			setMarkdown(initialMarkdown);
		}
	}, [visible, initialTitle, initialMarkdown]);

	const hasBody = markdown.trim().length > 0;
	const hasTitle = title.trim().length > 0;
	const needsTitle = hasBody && !hasTitle;
	// A review requires both a title and a body.
	const canSave = hasTitle && hasBody && !isSaving;

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
							{isEditing ? "Edit review" : "Write a review"}
						</Text>
						<Pressable hitSlop={8} onPress={onDismiss}>
							<X color="#94a3b8" size={22} />
						</Pressable>
					</View>

					<TextInput
						value={title}
						onChangeText={setTitle}
						placeholder="Review title"
						placeholderTextColor="#94a3b8"
						className="rounded-lg border border-border bg-background-subtle p-3 font-sans text-base text-foreground"
					/>

					<TextInput
						value={markdown}
						onChangeText={setMarkdown}
						placeholder="Write a review (markdown supported)…"
						placeholderTextColor="#94a3b8"
						multiline
						textAlignVertical="top"
						maxLength={20000}
						className="min-h-36 rounded-lg border border-border bg-background-subtle p-3 font-sans text-base text-foreground"
					/>

					{needsTitle ? (
						<Text className="text-destructive text-xs">
							A title is required when you write a review.
						</Text>
					) : null}

					{isEditing && onDelete ? (
						<Pressable
							onPress={onDelete}
							disabled={isDeleting}
							className="flex-row items-center justify-center gap-2 rounded-lg border border-destructive px-4 py-3"
							style={{ opacity: isDeleting ? 0.6 : 1 }}
						>
							<Trash2 color="#ef4444" size={18} />
							<Text className="font-semibold text-destructive">
								Delete review
							</Text>
						</Pressable>
					) : null}

					<Pressable
						onPress={() => onSave({ title, markdown })}
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
