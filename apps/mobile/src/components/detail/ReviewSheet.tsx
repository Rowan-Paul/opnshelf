import { StarOff, Trash2, X } from "lucide-react-native";
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
	/** Existing rating (1-10), review title and body, if already saved. */
	initialRating?: number;
	initialTitle?: string;
	initialMarkdown?: string;
	hasExistingReview: boolean;
	/** Whether a clearable star rating currently exists for this item. */
	hasRating?: boolean;
	/** Whether a deletable review document currently exists for this item. */
	hasReviewDoc?: boolean;
	onSave: (input: {
		rating: number;
		title?: string;
		markdown?: string;
	}) => void;
	onClearRating: () => void;
	onDeleteReview: () => void;
	isSaving?: boolean;
	isClearingRating?: boolean;
	isDeleting?: boolean;
}

/**
 * Bottom-anchored modal for rating + writing/editing/deleting a review. The
 * star rating (1-10 via half-steps) and the long-form review are separate
 * entities: a rating alone is enough to save, but writing a review body
 * requires a title. `TextInput` and `Modal` are RN-core so `className` works
 * directly.
 */
export function ReviewSheet({
	visible,
	onDismiss,
	initialRating = 0,
	initialTitle = "",
	initialMarkdown = "",
	hasExistingReview,
	hasRating = false,
	hasReviewDoc = false,
	onSave,
	onClearRating,
	onDeleteReview,
	isSaving = false,
	isClearingRating = false,
	isDeleting = false,
}: ReviewSheetProps) {
	const [rating, setRating] = useState(initialRating);
	const [title, setTitle] = useState(initialTitle);
	const [markdown, setMarkdown] = useState(initialMarkdown);

	// Re-sync local state whenever the sheet is (re)opened for a target.
	useEffect(() => {
		if (visible) {
			setRating(initialRating);
			setTitle(initialTitle);
			setMarkdown(initialMarkdown);
		}
	}, [visible, initialRating, initialTitle, initialMarkdown]);

	const hasBody = markdown.trim().length > 0;
	const needsTitle = hasBody && title.trim().length === 0;
	// Rating and review are independent: a rating alone or a review alone is
	// enough to save. Writing a review body still requires a title.
	const canSave = (rating > 0 || hasBody) && !needsTitle && !isSaving;

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
							{rating > 0
								? `${(rating / 2).toFixed(1)} / 5`
								: "Tap to rate (optional)"}
						</Text>
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
						placeholder="Write a review (optional, markdown supported)…"
						placeholderTextColor="#94a3b8"
						multiline
						textAlignVertical="top"
						maxLength={20000}
						className="min-h-24 rounded-lg border border-border bg-background-subtle p-3 font-sans text-base text-foreground"
					/>

					{needsTitle ? (
						<Text className="text-destructive text-xs">
							A title is required when you write a review.
						</Text>
					) : null}

					{hasRating || hasReviewDoc ? (
						<View className="flex-row items-center gap-3">
							{hasRating ? (
								<Pressable
									onPress={onClearRating}
									disabled={isClearingRating}
									className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-border px-4 py-3"
									style={{ opacity: isClearingRating ? 0.6 : 1 }}
								>
									<StarOff color="#94a3b8" size={18} />
									<Text className="font-semibold text-muted-foreground">
										Clear rating
									</Text>
								</Pressable>
							) : null}
							{hasReviewDoc ? (
								<Pressable
									onPress={onDeleteReview}
									disabled={isDeleting}
									className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-destructive px-4 py-3"
									style={{ opacity: isDeleting ? 0.6 : 1 }}
								>
									<Trash2 color="#ef4444" size={18} />
									<Text className="font-semibold text-destructive">
										Delete review
									</Text>
								</Pressable>
							) : null}
						</View>
					) : null}

					<View className="flex-row items-center gap-3">
						<Pressable
							onPress={() => onSave({ rating, title, markdown })}
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
