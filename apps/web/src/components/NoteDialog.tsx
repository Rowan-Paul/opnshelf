import { Loader2, Save, StickyNote, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { useAuth } from "#/lib/auth-context";
import { useDeleteNote, useNote, useUpsertNote } from "#/lib/hooks/useNotes";

interface NoteDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mediaType: "movie" | "show";
	mediaId: string;
	seasonNumber?: number;
	episodeNumber?: number;
	onSuccess?: () => void;
}

export function NoteDialog({
	open,
	onOpenChange,
	mediaType,
	mediaId,
	seasonNumber,
	episodeNumber,
	onSuccess,
}: NoteDialogProps) {
	const { user } = useAuth();
	const userDid = user?.did ?? "";

	const { data: note } = useNote({
		userDid,
		mediaType,
		mediaId,
		seasonNumber,
		episodeNumber,
	});

	const upsertMutation = useUpsertNote({
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

	const [content, setContent] = useState("");

	useEffect(() => {
		if (open) setContent(note?.content ?? "");
	}, [open, note?.content]);

	const close = () => {
		onOpenChange(false);
		onSuccess?.();
	};

	const handleSave = () => {
		if (!content.trim()) {
			if (note?.id) {
				deleteMutation.mutate(
					{ path: { noteId: note.id } },
					{ onSuccess: close },
				);
			} else {
				close();
			}
			return;
		}
		upsertMutation.mutate(
			{
				body: {
					mediaType:
						episodeNumber != null
							? "episode"
							: seasonNumber != null
								? "season"
								: mediaType,
					mediaId,
					seasonNumber,
					episodeNumber,
					content: content.trim(),
				},
			},
			{ onSuccess: close },
		);
	};

	const handleDelete = () => {
		if (!note?.id) return;
		deleteMutation.mutate({ path: { noteId: note.id } }, { onSuccess: close });
	};

	const isPending = upsertMutation.isPending || deleteMutation.isPending;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<StickyNote className="size-4 text-(--accent)" />
						{note?.content ? "Edit Note" : "Add a Note"}
					</DialogTitle>
					<DialogDescription className="sr-only">
						Add or edit a personal note for this title.
					</DialogDescription>
				</DialogHeader>
				<textarea
					value={content}
					onChange={(e) => setContent(e.target.value)}
					placeholder="Write your thoughts about this..."
					className="input min-h-[140px] w-full resize-none text-sm"
					maxLength={5000}
					autoFocus
				/>
				<div className="flex items-center justify-between">
					<span className="text-(--foreground-subtle) text-xs">
						{content.length}/5000
					</span>
					<div className="flex gap-2">
						{note?.id && (
							<button
								type="button"
								onClick={handleDelete}
								disabled={isPending}
								className="btn btn-ghost btn-sm gap-1 text-red-500 hover:text-red-600"
							>
								{deleteMutation.isPending && (
									<Loader2 className="size-3.5 animate-spin" />
								)}
								Delete
							</button>
						)}
						<button
							type="button"
							onClick={() => onOpenChange(false)}
							className="btn btn-secondary btn-sm gap-1"
						>
							<X className="size-3.5" />
							Cancel
						</button>
						<button
							type="button"
							onClick={handleSave}
							disabled={isPending}
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
			</DialogContent>
		</Dialog>
	);
}
