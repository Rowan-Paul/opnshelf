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
import { StarRating } from "@/components/detail/StarRating";
import { Text } from "@/components/ui/text";

interface ReviewSheetProps {
	visible: boolean;
	onDismiss: () => void;
	/** Existing rating (1-10) and text, if the user already reviewed this. */
	initialRating?: number;
	initialContent?: string;
	hasExistingReview: boolean;
	onSave: (rating: number, content?: string) => void;
	onDelete: () => void;
	isSaving?: boolean;
	isDeleting?: boolean;
}

/**
 * Bottom-anchored modal for rating + writing/editing/deleting a review. Rating
 * is required (1-10 via star halves); the text is optional. `TextInput` and
 * `Modal` are RN-core so `className` works directly.
 */
export function ReviewSheet({
	visible,
	onDismiss,
	initialRating = 0,
	initialContent = "",
	hasExistingReview,
	onSave,
	onDelete,
	isSaving = false,
	isDeleting = false,
}: ReviewSheetProps) {
	const [rating, setRating] = useState(initialRating);
	const [content, setContent] = useState(initialContent);

	// Re-sync local state whenever the sheet is (re)opened for a target.
	useEffect(() => {
		if (visible) {
			setRating(initialRating);
			setContent(initialContent);
		}
	}, [visible, initialRating, initialContent]);

	const canSave = rating > 0 && !isSaving;

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
							{hasExistingReview ? "Edit your review" : "Rate & review"}
						</Text>
						<Pressable hitSlop={8} onPress={onDismiss}>
							<X color="#94a3b8" size={22} />
						</Pressable>
					</View>

					<View className="items-center gap-2 py-2">
						<StarRating rating={rating} onChange={setRating} size={36} />
						<Text className="text-muted-foreground text-sm">
							{rating > 0 ? `${(rating / 2).toFixed(1)} / 5` : "Tap to rate"}
						</Text>
					</View>

					<TextInput
						value={content}
						onChangeText={setContent}
						placeholder="Write a review (optional)…"
						placeholderTextColor="#94a3b8"
						multiline
						textAlignVertical="top"
						className="min-h-24 rounded-lg border border-border bg-background-subtle p-3 font-sans text-base text-foreground"
					/>

					<View className="flex-row items-center gap-3">
						{hasExistingReview ? (
							<Pressable
								onPress={onDelete}
								disabled={isDeleting}
								className="flex-row items-center gap-2 rounded-lg border border-destructive px-4 py-3"
								style={{ opacity: isDeleting ? 0.6 : 1 }}
							>
								<Trash2 color="#ef4444" size={18} />
								<Text className="font-semibold text-destructive">Delete</Text>
							</Pressable>
						) : null}
						<Pressable
							onPress={() => onSave(rating, content)}
							disabled={!canSave}
							className="flex-1 items-center rounded-lg bg-primary py-3"
							style={{ opacity: canSave ? 1 : 0.5 }}
						>
							<Text className="font-semibold text-primary-foreground">
								{isSaving ? "Saving…" : "Save"}
							</Text>
						</Pressable>
					</View>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}
