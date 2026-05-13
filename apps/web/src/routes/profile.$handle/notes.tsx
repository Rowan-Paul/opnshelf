import {
	notesControllerGetUserNotesOptions,
	notesControllerGetUserNotesQueryKey,
	usersControllerGetPublicProfileOptions,
} from "@opnshelf/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Pencil, Save, StickyNote, Trash2, X } from "lucide-react";
import { useState } from "react";

import { ProfileContentCard } from "#/components/ProfileContentCard";
import { setupApiClient } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";
import { useDeleteNote, useUpsertNote } from "#/lib/hooks/useNotes";
import { toSlug } from "#/lib/slug";

setupApiClient();

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
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(note.content);

	const resolvedMediaType =
		note.episodeNumber != null
			? "episode"
			: note.seasonNumber != null
				? "season"
				: note.mediaType === "movie"
					? "movie"
					: "show";

	const baseMediaType = note.mediaType === "movie" ? "movie" : "show";

	const upsertMutation = useUpsertNote({
		userDid,
		mediaType: baseMediaType as "movie" | "show",
		mediaId: note.mediaId,
		seasonNumber: note.seasonNumber,
		episodeNumber: note.episodeNumber,
	});

	const deleteMutation = useDeleteNote({
		userDid,
		mediaType: baseMediaType as "movie" | "show",
		mediaId: note.mediaId,
		seasonNumber: note.seasonNumber,
		episodeNumber: note.episodeNumber,
	});

	const noteListKey = notesControllerGetUserNotesQueryKey({
		path: { userDid },
		query: { limit: 50 },
	});

	const handleSave = () => {
		if (!editContent.trim()) {
			deleteMutation.mutate(
				{ path: { noteId: note.id } },
				{
					onSuccess: () => {
						queryClient.invalidateQueries({ queryKey: noteListKey });
						setIsEditing(false);
					},
				},
			);
			return;
		}

		upsertMutation.mutate(
			{
				body: {
					mediaType: resolvedMediaType,
					mediaId: note.mediaId,
					seasonNumber: note.seasonNumber,
					episodeNumber: note.episodeNumber,
					content: editContent.trim(),
				},
			},
			{
				onSuccess: () => {
					queryClient.invalidateQueries({ queryKey: noteListKey });
					setIsEditing(false);
				},
			},
		);
	};

	const handleDelete = () => {
		deleteMutation.mutate(
			{ path: { noteId: note.id } },
			{
				onSuccess: () => {
					queryClient.invalidateQueries({ queryKey: noteListKey });
				},
			},
		);
	};

	const handleCancel = () => {
		setEditContent(note.content);
		setIsEditing(false);
	};

	const posterUrl = note.posterPath
		? `https://image.tmdb.org/t/p/w300${note.posterPath}`
		: null;

	const link = getNoteLink(note);

	return (
		<ProfileContentCard
			posterUrl={posterUrl}
			to={link.to}
			params={link.params}
			title={note.title || "Unknown title"}
			headerRight={
				isOwner && !isEditing ? (
					<div className="flex items-center gap-1">
						<span className="text-(--foreground-subtle) text-xs">
							{new Date(note.updatedAt).toLocaleDateString()}
						</span>
						<button
							type="button"
							onClick={() => setIsEditing(true)}
							className="flex h-7 w-7 items-center justify-center rounded-md text-(--foreground-muted) transition-colors hover:bg-(--background-subtle) hover:text-(--accent)"
							aria-label="Edit note"
						>
							<Pencil className="size-3.5" />
						</button>
						<button
							type="button"
							onClick={handleDelete}
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
				) : null
			}
		>
			{isEditing ? (
				<div className="space-y-2">
					<textarea
						value={editContent}
						onChange={(e) => setEditContent(e.target.value)}
						className="input min-h-[100px] resize-none text-sm"
						maxLength={5000}
					/>
					<div className="flex items-center justify-between">
						<span className="text-(--foreground-subtle) text-xs">
							{editContent.length}/5000
						</span>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={handleCancel}
								className="btn btn-secondary btn-sm gap-1"
							>
								<X className="size-3.5" />
								Cancel
							</button>
							<button
								type="button"
								onClick={handleSave}
								disabled={upsertMutation.isPending}
								className="btn btn-primary btn-sm gap-1"
							>
								{upsertMutation.isPending ? (
									<Loader2 className="size-3.5 animate-spin" />
								) : (
									<Save className="size-3.5" />
								)}
								Save
							</button>
						</div>
					</div>
				</div>
			) : (
				<p className="line-clamp-4 whitespace-pre-wrap text-(--foreground) text-sm leading-relaxed">
					{note.content}
				</p>
			)}
		</ProfileContentCard>
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

	const { data, isLoading } = useQuery({
		...notesControllerGetUserNotesOptions({
			path: { userDid },
			query: { limit: 50 },
		}),
		enabled: !!userDid,
	});

	const notes = data?.items ?? [];

	return (
		<div className="space-y-6">
			{/* Title */}
			<div className="flex items-center justify-between">
				<h1 className="text-display-2">Notes</h1>
			</div>

			{/* Notes List */}
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
					<StickyNote className="mx-auto mb-3 size-8 text-(--foreground-muted)" />
					<p className="text-(--foreground-muted)">No notes yet.</p>
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
		</div>
	);
}
