import type { UserNoteDto } from "@opnshelf/api";
import { StickyNote } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { ProfileContentCard } from "@/components/profile/ProfileContentCard";
import { ReviewsSkeleton } from "@/components/ui/skeletons";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { mediaHref } from "@/lib/media-href";
import { useProfileNotes } from "@/lib/use-public-profile";

/**
 * Notes tab: the user's notes, cursor-paginated with a Load more button.
 * Read-only on mobile (no inline edit/delete — those live on the detail
 * screens). Mirrors the web Notes page layout.
 */
export function NotesTab({
	userDid,
	isOwner,
}: {
	userDid: string;
	isOwner: boolean;
}) {
	const [cursor, setCursor] = useState<string | undefined>(undefined);
	const { data, isLoading, isError } = useProfileNotes(userDid, cursor);

	const notes = data?.items ?? [];
	const hasMore = data?.nextCursor != null;

	return (
		<View className="gap-4 px-4 pt-4 pb-12">
			<Text className="font-bold font-display text-2xl text-foreground">
				Notes
			</Text>

			{isLoading ? (
				<ReviewsSkeleton />
			) : isError ? (
				<ErrorState message="Couldn't load notes." />
			) : notes.length === 0 ? (
				<EmptyState
					icon={StickyNote}
					title={isOwner ? "No notes yet" : "No notes"}
				/>
			) : (
				<View className="gap-3">
					{notes.map((note) => (
						<NoteCard key={note.id} note={note} />
					))}
				</View>
			)}

			{hasMore ? (
				<Pressable
					onPress={() => setCursor(data?.nextCursor ?? undefined)}
					className="items-center rounded-lg border border-border py-2.5"
				>
					<Text className="font-medium text-foreground text-sm">Load more</Text>
				</Pressable>
			) : null}
		</View>
	);
}

function NoteCard({ note }: { note: UserNoteDto }) {
	return (
		<ProfileContentCard
			posterUrl={
				note.posterPath
					? `https://image.tmdb.org/t/p/w300${note.posterPath}`
					: undefined
			}
			href={mediaHref(note)}
			title={note.title || "Unknown title"}
			meta={new Date(note.updatedAt).toLocaleDateString()}
		>
			<Text className="text-foreground text-sm leading-5" numberOfLines={5}>
				{note.content}
			</Text>
		</ProfileContentCard>
	);
}
