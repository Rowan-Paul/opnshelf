import { Trash2, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	View,
} from "react-native";
import { MarkdownToolbar } from "@/components/detail/MarkdownToolbar";
import { Markdown } from "@/components/ui/Markdown";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import type { TextSelection } from "@/lib/markdown-format";

const MAX_LENGTH = 20000;

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
 * Bottom-anchored modal for writing or editing a single long-form review.
 *
 * The body is authored as markdown — the source-of-truth format for reviews
 * across the standard.site ecosystem — with a formatting toolbar over the
 * `TextInput` and a Write/Preview toggle. The toolbar rewrites the markdown
 * string directly (rather than holding a separate rich-text model), so the
 * editor round-trips stored markdown losslessly. The star rating is a separate
 * one-per-media entity handled elsewhere; this sheet is review-only. A review
 * requires both a title and a markdown body.
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
	const [selection, setSelection] = useState<TextSelection>({
		start: 0,
		end: 0,
	});
	const [mode, setMode] = useState<"write" | "preview">("write");

	// Re-sync local state whenever the sheet is (re)opened for a target.
	useEffect(() => {
		if (visible) {
			setTitle(initialTitle);
			setMarkdown(initialMarkdown);
			setSelection({
				start: initialMarkdown.length,
				end: initialMarkdown.length,
			});
			setMode("write");
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

					<TextField
						variant="subtle"
						value={title}
						onChangeText={setTitle}
						placeholder="Review title"
						maxLength={300}
					/>

					<View className="flex-row gap-1 self-start rounded-lg bg-background-subtle p-1">
						<Pressable
							onPress={() => setMode("write")}
							className={`rounded-md px-3 py-1.5 ${mode === "write" ? "bg-card" : ""}`}
						>
							<Text
								className={`text-sm ${mode === "write" ? "font-semibold text-foreground" : "text-muted-foreground"}`}
							>
								Write
							</Text>
						</Pressable>
						<Pressable
							onPress={() => setMode("preview")}
							className={`rounded-md px-3 py-1.5 ${mode === "preview" ? "bg-card" : ""}`}
						>
							<Text
								className={`text-sm ${mode === "preview" ? "font-semibold text-foreground" : "text-muted-foreground"}`}
							>
								Preview
							</Text>
						</Pressable>
					</View>

					{mode === "write" ? (
						<View className="gap-2">
							<MarkdownToolbar
								value={markdown}
								selection={selection}
								onChange={(edit) => {
									setMarkdown(edit.text);
									setSelection(edit.selection);
								}}
							/>
							<TextField
								variant="subtle"
								multiline
								className="min-h-36"
								value={markdown}
								onChangeText={setMarkdown}
								selection={selection}
								onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
								placeholder="Write a review (markdown supported)…"
								maxLength={MAX_LENGTH}
							/>
						</View>
					) : (
						<ScrollView
							className="min-h-36 rounded-lg border border-border bg-background-subtle"
							contentContainerClassName="p-3"
							style={{ maxHeight: 320 }}
						>
							{hasBody ? (
								<Markdown value={markdown} />
							) : (
								<Text className="text-muted-foreground text-sm">
									Nothing to preview yet.
								</Text>
							)}
						</ScrollView>
					)}

					<View className="flex-row items-center justify-between">
						{needsTitle ? (
							<Text className="text-destructive text-xs">
								A title is required when you write a review.
							</Text>
						) : (
							<View />
						)}
						<Text className="text-foreground-subtle text-xs">
							{markdown.length}/{MAX_LENGTH}
						</Text>
					</View>

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
