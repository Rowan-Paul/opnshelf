import { Loader2, Pencil, StickyNote, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "#/lib/auth-context";
import { useDeleteNote, useNote } from "#/lib/hooks/useNotes";
import { NoteDialog } from "./NoteDialog";

interface NotesSectionProps {
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
}

export default function NotesSection({
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
}: NotesSectionProps) {
	const { user, isAuthenticated } = useAuth();
	const userDid = user?.did ?? "";
	const [dialogOpen, setDialogOpen] = useState(false);

	const { data: note, isLoading } = useNote({
		userDid,
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	const deleteMutation = useDeleteNote({
		userDid,
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	if (!isAuthenticated) return null;

	if (isLoading) {
		return (
			<section className="card p-5">
				<div className="flex items-center gap-2 text-(--foreground-muted)">
					<Loader2 className="size-4 animate-spin" />
					<span className="text-sm">Loading notes...</span>
				</div>
			</section>
		);
	}

	return (
		<>
			<section className="card p-5">
				<div className="mb-3 flex items-center justify-between">
					<h3 className="flex items-center gap-2 font-display font-semibold">
						<StickyNote className="size-4 text-(--accent)" />
						Your Note
					</h3>
					{note?.content && (
						<div className="flex gap-1">
							<button
								type="button"
								onClick={() => setDialogOpen(true)}
								className="flex h-8 w-8 items-center justify-center rounded-md text-(--foreground-muted) transition-colors hover:bg-(--background-subtle) hover:text-(--accent)"
								aria-label="Edit note"
							>
								<Pencil className="size-4" />
							</button>
							<button
								type="button"
								onClick={() =>
									note.id &&
									deleteMutation.mutate({ path: { noteId: note.id } })
								}
								disabled={deleteMutation.isPending}
								className="flex h-8 w-8 items-center justify-center rounded-md text-(--foreground-muted) transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
								aria-label="Delete note"
							>
								{deleteMutation.isPending ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<Trash2 className="size-4" />
								)}
							</button>
						</div>
					)}
				</div>

				{note?.content ? (
					<p className="whitespace-pre-wrap text-(--foreground-muted) text-sm leading-relaxed">
						{note.content}
					</p>
				) : (
					<>
						<p className="mb-3 text-(--foreground-muted) text-sm">
							No notes yet. Add your thoughts about this title.
						</p>
						<button
							type="button"
							onClick={() => setDialogOpen(true)}
							className="btn btn-secondary btn-sm gap-1"
						>
							<StickyNote className="size-3.5" />
							Add note
						</button>
					</>
				)}
			</section>

			<NoteDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				mediaType={mediaType}
				mediaId={mediaId}
				seasonNumber={seasonNumber}
				episodeNumber={episodeNumber}
			/>
		</>
	);
}
