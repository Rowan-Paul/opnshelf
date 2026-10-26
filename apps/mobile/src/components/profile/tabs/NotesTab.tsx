import {
	notesControllerDeleteNoteMutation,
	notesControllerGetNoteQueryKey,
	notesControllerUpsertNoteMutation,
	type UserNoteDto,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, StickyNote, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { NoteEditorSheet } from "@/components/detail/NoteEditorSheet";
import { ProfileContentCard } from "@/components/profile/ProfileContentCard";
import { useDialog } from "@/components/ui/dialog";
import { canLoadMore, LoadMoreFooter } from "@/components/ui/load-more";
import { ReviewsSkeleton } from "@/components/ui/skeletons";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { mediaHref } from "@/lib/media-href";
import { useEndReached } from "@/lib/use-end-reached";
import { invalidateUserNotesQueries } from "@/lib/use-note";
import { useInfiniteProfileNotes } from "@/lib/use-public-profile";
import { useThemeColors } from "@/theme/colors";

/**
 * Notes tab: the user's notes, loaded page by page as the reader scrolls (the
 * enclosing screen's `EndReachedScrollView` drives it). The owner can edit
 * (note editor sheet) and delete each note, mirroring the web Notes page.
 */
export function NotesTab({
	userDid,
	isOwner,
}: {
	userDid: string;
	isOwner: boolean;
}) {
	const {
		data,
		isLoading,
		isError,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isFetchNextPageError,
	} = useInfiniteProfileNotes(userDid);

	const notes = data?.pages.flatMap((page) => page.items) ?? [];
	const loadMore = { hasNextPage, isFetchingNextPage, isFetchNextPageError };
	useEndReached(() => {
		if (canLoadMore(loadMore)) void fetchNextPage();
	});

	return (
		<View className="gap-4 px-4 pt-4 pb-12">
			<Text className="text-display-2 text-foreground">Notes</Text>

			{isLoading ? (
				<ReviewsSkeleton />
			) : isError && notes.length === 0 ? (
				<ErrorState message="Couldn't load notes." />
			) : notes.length === 0 ? (
				<EmptyState
					icon={StickyNote}
					message={
						isOwner ? "You haven't written any notes yet." : "No notes yet."
					}
				/>
			) : (
				<View className="gap-3">
					{notes.map((note) => (
						<NoteCard
							key={note.id}
							note={note}
							isOwner={isOwner}
							userDid={userDid}
						/>
					))}
				</View>
			)}

			<LoadMoreFooter
				{...loadMore}
				onRetry={() => void fetchNextPage()}
				skeleton={<ReviewsSkeleton rows={1} />}
			/>
		</View>
	);
}

function NoteCard({
	note,
	isOwner,
	userDid,
}: {
	note: UserNoteDto;
	isOwner: boolean;
	userDid: string;
}) {
	const colors = useThemeColors();
	const { showDialog } = useDialog();
	const queryClient = useQueryClient();
	const toast = useToast();
	const [editorVisible, setEditorVisible] = useState(false);

	const upsertMutation = useMutation({
		mutationKey: ["notes", note.id, "update"],
		...notesControllerUpsertNoteMutation(),
	});
	const deleteMutation = useMutation({
		mutationKey: ["notes", note.id, "delete"],
		...notesControllerDeleteNoteMutation(),
	});

	// The list plus this item's own note query, so the detail screen's note
	// button reflects the change too.
	const invalidate = () => {
		invalidateUserNotesQueries(queryClient, userDid);
		void queryClient.invalidateQueries({
			queryKey: notesControllerGetNoteQueryKey({
				path: { userDid },
				query: {
					mediaType: note.mediaType,
					mediaId: note.mediaId,
					seasonNumber: note.seasonNumber,
					episodeNumber: note.episodeNumber,
				},
			}),
		});
	};

	const handleSave = (content: string) => {
		const trimmed = content.trim();
		if (!trimmed) return;
		upsertMutation.mutate(
			{
				body: {
					mediaType: note.mediaType,
					mediaId: note.mediaId,
					seasonNumber: note.seasonNumber,
					episodeNumber: note.episodeNumber,
					content: trimmed,
				},
			},
			{
				onSuccess: () => {
					setEditorVisible(false);
					invalidate();
					toast.success("Note saved");
				},
				onError: () => toast.error("Failed to save note"),
			},
		);
	};

	const performDelete = () => {
		deleteMutation.mutate(
			{ path: { noteId: note.id } },
			{
				onSuccess: () => {
					invalidate();
					toast.success("Note deleted");
				},
				onError: () => toast.error("Failed to delete note"),
			},
		);
	};

	const confirmDelete = () =>
		showDialog({
			title: "Delete note?",
			description: `This permanently deletes your note for "${note.mediaLabel || "this title"}". This can't be undone.`,
			actions: [
				{ label: "Cancel" },
				{ label: "Delete", variant: "destructive", onPress: performDelete },
			],
		});

	return (
		<>
			<ProfileContentCard
				posterUrl={
					note.posterPath
						? `https://image.tmdb.org/t/p/w300${note.posterPath}`
						: undefined
				}
				href={mediaHref(note)}
				title={note.mediaLabel || "Unknown title"}
				meta={new Date(note.updatedAt).toLocaleDateString()}
				headerRight={
					isOwner ? (
						<View className="flex-row gap-1">
							<Pressable
								hitSlop={8}
								accessibilityRole="button"
								accessibilityLabel="Edit note"
								onPress={() => setEditorVisible(true)}
								className="size-8 items-center justify-center rounded-md"
							>
								<Pencil color={colors.mutedForeground} size={16} />
							</Pressable>
							<Pressable
								hitSlop={8}
								accessibilityRole="button"
								accessibilityLabel="Delete note"
								disabled={deleteMutation.isPending}
								onPress={confirmDelete}
								className="size-8 items-center justify-center rounded-md"
							>
								{deleteMutation.isPending ? (
									<ActivityIndicator size="small" color={colors.destructive} />
								) : (
									<Trash2 color={colors.destructive} size={16} />
								)}
							</Pressable>
						</View>
					) : undefined
				}
			>
				<Text className="text-foreground text-sm leading-5" numberOfLines={5}>
					{note.content}
				</Text>
			</ProfileContentCard>

			{isOwner ? (
				<NoteEditorSheet
					visible={editorVisible}
					onDismiss={() => setEditorVisible(false)}
					isEditing
					initialContent={note.content}
					onSave={handleSave}
					onDelete={() => {
						setEditorVisible(false);
						confirmDelete();
					}}
					isSaving={upsertMutation.isPending}
					isDeleting={deleteMutation.isPending}
				/>
			) : null}
		</>
	);
}
