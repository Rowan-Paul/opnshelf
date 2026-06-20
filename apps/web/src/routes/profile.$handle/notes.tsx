import {
	notesControllerGetUserNotesOptions,
	notesControllerGetUserNotesQueryKey,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import ConfirmDialog from "#/components/ConfirmDialog";
import { NoteDialog } from "#/components/NoteDialog";
import { ProfileContentCard } from "#/components/ProfileContentCard";
import { useAuth } from "#/lib/auth-context";
import { useDeleteNote } from "#/lib/hooks/useNotes";
import { toSlug } from "#/lib/slug";
export const Route = createFileRoute("/profile/$handle/notes")({
	component: ProfileNotesPage,
});

function getNoteLink(note: {
	mediaType: string;
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
	title?: string;
}) {
	const nameSlug = toSlug(note.title || "");
	if (note.mediaType === "movie") {
		return {
			to: "/movies/$movieId/$movieName" as const,
			params: { movieId: note.mediaId, movieName: nameSlug },
		};
	}
	if (note.episodeNumber != null) {
		return {
			to: "/shows/$showId/$showName/seasons/$seasonNumber/episodes/$episodeNumber" as const,
			params: {
				showId: note.mediaId,
				showName: nameSlug,
				seasonNumber: String(note.seasonNumber || 0),
				episodeNumber: String(note.episodeNumber || 0),
			},
		};
	}
	if (note.seasonNumber != null) {
		return {
			to: "/shows/$showId/$showName/seasons/$seasonNumber" as const,
			params: {
				showId: note.mediaId,
				showName: nameSlug,
				seasonNumber: String(note.seasonNumber || 0),
			},
		};
	}
	return {
		to: "/shows/$showId/$showName" as const,
		params: { showId: note.mediaId, showName: nameSlug },
	};
}

function NoteCard({
	note,
	isOwner,
	userDid,
}: {
	note: {
		id: string;
		content: string;
		mediaType: string;
		mediaId: string;
		seasonNumber?: number;
		episodeNumber?: number;
		title?: string;
		posterPath?: string;
		createdAt: string;
		updatedAt: string;
	};
	isOwner: boolean;
	userDid: string;
}) {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);

	const baseMediaType =
		note.mediaType === "movie" ? "movie" : ("show" as const);

	const deleteMutation = useDeleteNote({
		userDid,
		mediaType: baseMediaType,
		mediaId: note.mediaId,
		seasonNumber: note.seasonNumber,
		episodeNumber: note.episodeNumber,
	});

	const noteListKey = notesControllerGetUserNotesQueryKey({
		path: { userDid },
		query: { limit: 20 },
	});

	const invalidateList = () =>
		queryClient.invalidateQueries({ queryKey: noteListKey });

	const handleDelete = () => {
		deleteMutation.mutate(
			{ path: { noteId: note.id } },
			{
				onSuccess: () => {
					setConfirmOpen(false);
					invalidateList();
				},
			},
		);
	};

	const posterUrl = note.posterPath
		? `https://image.tmdb.org/t/p/w300${note.posterPath}`
		: null;

	const link = getNoteLink(note);

	return (
		<>
			<ProfileContentCard
				posterUrl={posterUrl}
				to={link.to}
				params={link.params}
				title={note.title || "Unknown title"}
				meta={new Date(note.updatedAt).toLocaleDateString()}
				headerRight={
					isOwner ? (
						<div className="flex gap-1">
							<button
								type="button"
								onClick={() => setDialogOpen(true)}
								className="flex h-7 w-7 items-center justify-center rounded-md text-(--foreground-muted) transition-colors hover:bg-(--background-subtle) hover:text-(--accent)"
								aria-label="Edit note"
							>
								<Pencil className="size-3.5" />
							</button>
							<button
								type="button"
								onClick={() => setConfirmOpen(true)}
								disabled={deleteMutation.isPending}
								className="flex h-7 w-7 items-center justify-center rounded-md text-(--foreground-muted) transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
								aria-label="Delete note"
							>
								{deleteMutation.isPending ? (
									<Loader2 className="size-3.5 animate-spin" />
								) : (
									<Trash2 className="size-3.5" />
								)}
							</button>
						</div>
					) : undefined
				}
			>
				<p className="line-clamp-4 whitespace-pre-wrap text-(--foreground) text-sm leading-relaxed">
					{note.content}
				</p>
			</ProfileContentCard>
			<NoteDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				mediaType={baseMediaType}
				mediaId={note.mediaId}
				seasonNumber={note.seasonNumber}
				episodeNumber={note.episodeNumber}
				onSuccess={invalidateList}
			/>
			<ConfirmDialog
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				title="Delete note?"
				description={
					<>
						This permanently deletes your note for{" "}
						<strong>{note.title || "this title"}</strong>. This action cannot be
						undone.
					</>
				}
				confirmLabel="Delete note"
				pendingLabel="Deleting..."
				onConfirm={handleDelete}
				isPending={deleteMutation.isPending}
			/>
		</>
	);
}

function ProfileNotesPage() {
	const { handle } = Route.useParams();
	const { user } = useAuth();

	const { data: profile } = useQuery({
		...usersControllerGetPublicProfileOptions({ path: { handle } }),
	});
	const userDid = profile?.did || "";
	const isOwner = user?.did === userDid;

	const [cursor, setCursor] = useState<string | undefined>(undefined);

	const { data, isLoading } = useQuery({
		...notesControllerGetUserNotesOptions({
			path: { userDid },
			query: { limit: 20, ...(cursor ? { cursor } : {}) },
		}),
		enabled: !!userDid,
	});

	const notes = data?.items ?? [];
	const hasMore = data?.nextCursor != null;

	return (
		<div className="space-y-6">
			<h1 className="text-display-2">Notes</h1>

			{isLoading ? (
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					{[1, 2, 3, 4].map((i) => (
						<div key={i} className="card flex gap-4 p-4 sm:p-5">
							<div className="h-28 w-20 shrink-0 animate-pulse rounded-lg bg-(--background-subtle) sm:h-36 sm:w-24" />
							<div className="flex-1 space-y-2">
								<div className="h-4 w-3/4 animate-pulse rounded bg-(--background-subtle)" />
								<div className="h-3 w-1/2 animate-pulse rounded bg-(--background-subtle)" />
								<div className="h-3 w-full animate-pulse rounded bg-(--background-subtle)" />
							</div>
						</div>
					))}
				</div>
			) : notes.length === 0 ? (
				<div className="card p-8 text-center">
					<p className="text-(--foreground-muted)">
						{isOwner ? "You haven't written any notes yet." : "No notes yet."}
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					{notes.map((note) => (
						<NoteCard
							key={note.id}
							note={note}
							isOwner={isOwner}
							userDid={userDid}
						/>
					))}
				</div>
			)}

			{hasMore && (
				<div className="flex justify-center">
					<button
						type="button"
						onClick={() => setCursor(data?.nextCursor ?? undefined)}
						className="btn btn-secondary"
					>
						Load more
					</button>
				</div>
			)}
		</div>
	);
}
