import type { UserNoteDto } from "@opnshelf/api";
import { StickyNote } from "lucide-react-native";
import { View } from "react-native";
import { ProfileContentCard } from "@/components/profile/ProfileContentCard";
import { canLoadMore, LoadMoreFooter } from "@/components/ui/load-more";
import { ReviewsSkeleton } from "@/components/ui/skeletons";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { mediaHref } from "@/lib/media-href";
import { useEndReached } from "@/lib/use-end-reached";
import { useInfiniteProfileNotes } from "@/lib/use-public-profile";

/**
 * Notes tab: the user's notes, loaded page by page as the reader scrolls (the
 * enclosing screen's `EndReachedScrollView` drives it). Read-only on mobile
 * (no inline edit/delete — those live on the detail screens). Mirrors the web
 * Notes page layout.
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
			<Text className="font-bold font-display text-2xl text-foreground">
				Notes
			</Text>

			{isLoading ? (
				<ReviewsSkeleton />
			) : isError && notes.length === 0 ? (
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

			<LoadMoreFooter
				{...loadMore}
				onRetry={() => void fetchNextPage()}
				skeleton={<ReviewsSkeleton rows={1} />}
			/>
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
			title={note.mediaLabel || "Unknown title"}
			meta={new Date(note.updatedAt).toLocaleDateString()}
		>
			<Text className="text-foreground text-sm leading-5" numberOfLines={5}>
				{note.content}
			</Text>
		</ProfileContentCard>
	);
}
