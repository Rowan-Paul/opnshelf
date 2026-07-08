import { StickyNote } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { NoteEditorSheet } from "@/components/detail/NoteEditorSheet";
import { Text } from "@/components/ui/text";
import { useNote } from "@/lib/use-note";

/**
 * "Note" action for media detail screens. Mirrors the `RatingButton` /
 * `AddToListButton` pattern: a single outlined button that opens a sheet to
 * read, edit and delete the user's single freeform note, keeping the note out
 * of the page's primary content surface. Supports movie/show as well as
 * season/episode scope via the optional season/episode numbers.
 */
export function NoteButton({
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}) {
	const { note, isAuthenticated, saveNote, deleteNote, isSaving, isDeleting } =
		useNote({ mediaType, mediaId, seasonNumber, episodeNumber });

	const [sheetVisible, setSheetVisible] = useState(false);

	if (!isAuthenticated) return null;

	const hasNote = !!note?.content;

	const handleSave = (content: string) => {
		saveNote(content);
		setSheetVisible(false);
	};

	const handleDelete = () => {
		deleteNote();
		setSheetVisible(false);
	};

	return (
		<View className="flex-1">
			<Pressable
				onPress={() => setSheetVisible(true)}
				className="items-center justify-center gap-1 rounded-lg border border-border px-1 py-2.5"
			>
				<StickyNote
					color={hasNote ? "#f3bc00" : "#94a3b8"}
					fill={hasNote ? "#f3bc00" : "transparent"}
					size={18}
				/>
				<Text className="font-medium text-foreground text-xs" numberOfLines={1}>
					Note
				</Text>
			</Pressable>

			<NoteEditorSheet
				visible={sheetVisible}
				onDismiss={() => setSheetVisible(false)}
				isEditing={hasNote}
				initialContent={note?.content ?? ""}
				onSave={handleSave}
				onDelete={note?.id ? handleDelete : undefined}
				isSaving={isSaving}
				isDeleting={isDeleting}
			/>
		</View>
	);
}
