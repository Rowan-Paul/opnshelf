import { usersControllerGetMySettingsOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Trash2, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Modal, Pressable, Switch, View } from "react-native";
import {
	KeyboardAvoidingView,
	KeyboardProvider,
} from "react-native-keyboard-controller";
import { MilkdownWebView } from "@/components/detail/MilkdownWebView";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useTwStyle } from "@/lib/use-tw-style";

const MAX_LENGTH = 20000;

interface ReviewEditorSheetProps {
	visible: boolean;
	onDismiss: () => void;
	/** Existing review title and body when editing; empty when writing a new one. */
	initialTitle?: string;
	initialMarkdown?: string;
	/** Current mirror state when editing; defaults to on for a new review. */
	initialMirrorToBlog?: boolean;
	/** Whether the sheet is editing an existing review (vs. writing a new one). */
	isEditing?: boolean;
	onSave: (input: {
		title: string;
		markdown: string;
		mirrorToBlog: boolean;
	}) => void;
	/** Provided only when editing — deletes the review being edited. */
	onDelete?: () => void;
	isSaving?: boolean;
	isDeleting?: boolean;
}

/**
 * Bottom-anchored modal for writing or editing a single long-form review.
 *
 * The body is authored in the same Milkdown WYSIWYG editor the web app uses,
 * hosted in a WebView (see MilkdownWebView) so both platforms share one editor
 * and one markdown serializer. Markdown stays the source of truth and round-
 * trips losslessly. The star rating is a separate one-per-media entity handled
 * elsewhere; this sheet is review-only. A review requires a title and a body.
 */
export function ReviewEditorSheet({
	visible,
	onDismiss,
	initialTitle = "",
	initialMarkdown = "",
	initialMirrorToBlog = true,
	isEditing = false,
	onSave,
	onDelete,
	isSaving = false,
	isDeleting = false,
}: ReviewEditorSheetProps) {
	const [title, setTitle] = useState(initialTitle);
	const [markdown, setMarkdown] = useState(initialMarkdown);
	const [mirrorToBlog, setMirrorToBlog] = useState(initialMirrorToBlog);
	// Bumped on each open so the WebView editor remounts and re-seeds with the
	// current target's body (the sheet instance is reused across reviews).
	const [openCount, setOpenCount] = useState(0);

	// The mirror toggle only appears when the author has a blog configured.
	const { data: settings } = useQuery(usersControllerGetMySettingsOptions());
	const hasBlog = !!settings?.reviewsPublicationUri;
	const blogName =
		settings?.reviewsPublicationName ?? settings?.reviewsPublicationUri ?? null;
	// The keyboard controller's KeyboardAvoidingView is third-party, so resolve
	// its layout classes to a style object (Uniwind className only works on
	// RN-core components).
	const avoidingStyle = useTwStyle("flex-1 justify-end");

	// Re-sync local state whenever the sheet is (re)opened for a target.
	useEffect(() => {
		if (visible) {
			setTitle(initialTitle);
			setMarkdown(initialMarkdown);
			setMirrorToBlog(initialMirrorToBlog);
			setOpenCount((n) => n + 1);
		}
	}, [visible, initialTitle, initialMarkdown, initialMirrorToBlog]);

	const hasBody = markdown.trim().length > 0;
	const hasTitle = title.trim().length > 0;
	const needsTitle = hasBody && !hasTitle;
	// The WYSIWYG editor has no hard maxLength, so enforce the cap on the
	// serialized markdown here (mirrors the web ReviewDialog).
	const overLimit = markdown.length > MAX_LENGTH;
	// A review requires both a title and a body.
	const canSave = hasTitle && hasBody && !overLimit && !isSaving;

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent
			onRequestClose={onDismiss}
		>
			{/*
			 * RN <Modal> renders in a separate window outside the root
			 * KeyboardProvider (notably on Android), so the keyboard controller
			 * receives no events there. Nesting a KeyboardProvider inside the
			 * Modal re-bridges those events, letting its KeyboardAvoidingView lift
			 * the bottom-anchored sheet above the keyboard on both platforms.
			 */}
			<KeyboardProvider>
				<KeyboardAvoidingView behavior="padding" style={avoidingStyle}>
					<Pressable className="flex-1" onPress={onDismiss} />
					<View
						style={{ height: "85%" }}
						className="gap-4 rounded-t-2xl border border-border bg-card p-5"
					>
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

						<MilkdownWebView
							key={openCount}
							value={initialMarkdown}
							onChange={setMarkdown}
						/>

						<View className="flex-row items-center justify-between">
							{needsTitle ? (
								<Text className="text-destructive text-xs">
									A title is required when you write a review.
								</Text>
							) : (
								<View />
							)}
							<Text
								className={
									overLimit
										? "text-destructive text-xs"
										: "text-foreground-subtle text-xs"
								}
							>
								{markdown.length}/{MAX_LENGTH}
							</Text>
						</View>

						{hasBlog ? (
							<View className="flex-row items-center justify-between gap-3 rounded-lg bg-background-subtle px-3 py-2.5">
								<View className="flex-1">
									<Text className="font-medium text-foreground text-sm">
										Also publish to my blog
									</Text>
									{blogName ? (
										<Text
											className="text-muted-foreground text-xs"
											numberOfLines={1}
										>
											{blogName}
										</Text>
									) : null}
								</View>
								<Switch
									value={mirrorToBlog}
									onValueChange={setMirrorToBlog}
									trackColor={{ false: "#3f3f46", true: "#f3bc00" }}
									thumbColor="#ffffff"
								/>
							</View>
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
							onPress={() => onSave({ title, markdown, mirrorToBlog })}
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
			</KeyboardProvider>
		</Modal>
	);
}
