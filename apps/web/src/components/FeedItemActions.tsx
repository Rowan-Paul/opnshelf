import { Bookmark, BookmarkCheck, Library, Loader2 } from "lucide-react";
import { useState } from "react";
import ManageListsDialog from "#/components/ManageListsDialog";
import {
	useListItemStatus,
	useMediaWatchStatus,
	useWatchActions,
} from "#/lib/hooks";

interface FeedItemActionsMovieProps {
	type: "movie";
	mediaId: string;
}

interface FeedItemActionsShowProps {
	type: "show";
	mediaId: string;
	seasonNumber: number;
	episodeNumber: number;
}

type FeedItemActionsProps =
	| FeedItemActionsMovieProps
	| FeedItemActionsShowProps;

export default function FeedItemActions(props: FeedItemActionsProps) {
	const [listDialogOpen, setListDialogOpen] = useState(false);

	const isShow = props.type === "show";
	const { mediaId } = props;

	// For list operations, use episode-scoped mediaId so we add/remove
	// the specific episode, not the entire show.
	const listMediaId =
		isShow && props.seasonNumber > 0 && props.episodeNumber > 0
			? `${mediaId}:season:${props.seasonNumber}:episode:${props.episodeNumber}`
			: mediaId;

	const watchStatusOptions = isShow
		? ({ mediaType: "show", showId: mediaId } as const)
		: ({ mediaType: "movie", movieId: mediaId } as const);

	const { isWatched, isEpisodeWatched } =
		useMediaWatchStatus(watchStatusOptions);

	const watchActions = useWatchActions(watchStatusOptions);

	const { otherLists, userLists, listsForItem } = useListItemStatus({
		mediaType: props.type,
		mediaId: listMediaId,
	});

	const isListsLoading =
		!userLists || !listsForItem || otherLists === undefined;

	// Determine if this specific item is in the user's shelf
	let isInShelf: boolean;
	let isShelfPending: boolean;
	let handleToggleShelf: () => void;

	if (isShow) {
		const { seasonNumber, episodeNumber } = props;
		const episodeWatched = isEpisodeWatched
			? isEpisodeWatched(seasonNumber, episodeNumber)
			: false;
		isInShelf = episodeWatched;
		isShelfPending =
			watchActions.isMarkEpisodePending || watchActions.isUnmarkEpisodePending;
		handleToggleShelf = () => {
			if (episodeWatched) {
				watchActions.unmarkEpisodeWatched(seasonNumber, episodeNumber);
			} else {
				watchActions.markEpisodeWatched(seasonNumber, episodeNumber);
			}
		};
	} else {
		isInShelf = !!isWatched;
		isShelfPending =
			watchActions.isMarkMoviePending || watchActions.isUnmarkMoviePending;
		handleToggleShelf = () => {
			if (isWatched) {
				watchActions.unmarkMovieWatched();
			} else {
				watchActions.markMovieWatched();
			}
		};
	}

	return (
		<div className="flex items-center gap-2">
			{/* Shelf Toggle */}
			<button
				type="button"
				onClick={handleToggleShelf}
				disabled={isShelfPending}
				className={`btn btn-sm gap-1.5 ${
					isInShelf
						? "border-green-500/20 bg-green-500/10 text-green-600 hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-600"
						: "btn-secondary"
				}`}
			>
				{(() => {
					if (isShelfPending) {
						return (
							<>
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								Loading
							</>
						);
					}
					if (isInShelf) {
						return (
							<>
								<BookmarkCheck className="h-3.5 w-3.5" />
								Remove from shelf
							</>
						);
					}
					return (
						<>
							<Bookmark className="h-3.5 w-3.5" />
							Add to shelf
						</>
					);
				})()}
			</button>

			{/* Lists Toggle / Dialog */}
			<button
				type="button"
				onClick={() => setListDialogOpen(true)}
				disabled={isListsLoading}
				className="btn btn-secondary btn-sm gap-1.5"
			>
				{isListsLoading ? (
					<Loader2 className="h-3.5 w-3.5 animate-spin" />
				) : (
					<Library className="h-3.5 w-3.5" />
				)}
				{otherLists.length > 0 ? "Manage lists" : "Add to list"}
			</button>

			<ManageListsDialog
				mediaType={props.type}
				mediaId={listMediaId}
				open={listDialogOpen}
				onOpenChange={setListDialogOpen}
			/>
		</div>
	);
}
