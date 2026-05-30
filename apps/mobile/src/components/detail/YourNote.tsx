import { Pencil, Plus, StickyNote, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { NoteEditorSheet } from "@/components/detail/NoteEditorSheet";
import { Text } from "@/components/ui/text";
import { useNote } from "@/lib/use-note";

interface YourNoteProps {
	mediaType: "movie" | "show";
	mediaId: string;
}

/**
 * "Your Note" section for a media detail screen: shows the current user's
 * single freeform note for this title with edit/delete, or an add affordance
 * when empty. Mirrors the web `NotesSection`; note authoring/viewing only.
 */
export function YourNote({ mediaType, mediaId }: YourNoteProps) {
	const {
		note,
		isAuthenticated,
		isLoading,
		saveNote,
		deleteNote,
		isSaving,
		isDeleting,
	} = useNote({ mediaType, mediaId });

	const [editorVisible, setEditorVisible] = useState(false);

	if (!isAuthenticated) return null;

	const handleSave = (content: string) => {
		saveNote(content);
		setEditorVisible(false);
	};

	const handleDelete = () => {
		deleteNote();
		setEditorVisible(false);
	};

	return (
		<View className="gap-3 px-4">
			<View className="flex-row items-center justify-between">
				<View className="flex-row items-center gap-2">
					<StickyNote color="#f3bc00" size={18} />
					<Text className="font-display font-semibold text-base text-foreground">
						Your Note
					</Text>
				</View>
				{note?.content ? (
					<View className="flex-row gap-1">
						<Pressable
							hitSlop={8}
							onPress={() => setEditorVisible(true)}
							className="h-7 w-7 items-center justify-center rounded-md"
						>
							<Pencil color="#94a3b8" size={16} />
						</Pressable>
						<Pressable
							hitSlop={8}
							onPress={() => deleteNote()}
							disabled={isDeleting}
							className="h-7 w-7 items-center justify-center rounded-md"
							style={{ opacity: isDeleting ? 0.5 : 1 }}
						>
							<Trash2 color="#ef4444" size={16} />
						</Pressable>
					</View>
				) : null}
			</View>

			{isLoading ? (
				<View className="flex-row items-center gap-2 py-2">
					<ActivityIndicator size="small" />
					<Text className="text-muted-foreground text-sm">Loading note…</Text>
				</View>
			) : note?.content ? (
				<View className="rounded-xl border border-border bg-card p-3">
					<Text className="text-muted-foreground text-sm leading-5">
						{note.content}
					</Text>
				</View>
			) : (
				<Pressable
					onPress={() => setEditorVisible(true)}
					className="flex-row items-center gap-1.5 self-start rounded-lg border border-border px-3 py-1.5"
				>
					<Plus color="#94a3b8" size={16} />
					<Text className="font-medium text-foreground text-sm">Add note</Text>
				</Pressable>
			)}

			<NoteEditorSheet
				visible={editorVisible}
				onDismiss={() => setEditorVisible(false)}
				isEditing={!!note?.content}
				initialContent={note?.content ?? ""}
				onSave={handleSave}
				onDelete={note?.id ? handleDelete : undefined}
				isSaving={isSaving}
				isDeleting={isDeleting}
			/>
		</View>
	);
}
