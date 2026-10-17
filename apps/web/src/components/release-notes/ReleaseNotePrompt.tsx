import type { ReleaseNote } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useAuth } from "#/lib/auth-context";
import { useReleaseNotes } from "#/lib/use-release-notes";

export function ReleaseNotePrompt() {
	const { user } = useAuth();
	const notes = useReleaseNotes({ enabled: Boolean(user) });
	if (!user) return null;
	if (notes.isPending || notes.readPending) {
		return (
			<section
				aria-label="Loading what’s new"
				className="space-y-4 rounded-2xl border border-(--border) p-5 sm:p-6"
			>
				<div className="h-6 w-2/3 rounded bg-(--background-subtle) motion-safe:animate-pulse" />
				<div className="h-10 rounded bg-(--background-subtle) motion-safe:animate-pulse" />
				<div className="ml-auto h-10 w-40 rounded bg-(--background-subtle) motion-safe:animate-pulse" />
			</section>
		);
	}
	const entry = notes.data?.[0];
	if (!notes.unread || !entry) return null;
	const storageKey = `opnshelf.release-note-prompt.${user.did}.${entry.slug}`;
	return (
		<Announcement key={storageKey} storageKey={storageKey} entry={entry} />
	);
}

function Announcement({
	storageKey,
	entry,
}: {
	storageKey: string;
	entry: ReleaseNote;
}) {
	const [dismissed, setDismissed] = useState(() => {
		try {
			return localStorage.getItem(storageKey) === "1";
		} catch {
			return false;
		}
	});
	const dismiss = () => {
		setDismissed(true);
		try {
			localStorage.setItem(storageKey, "1");
		} catch {
			/* Keep dismissal for this visit when storage is unavailable. */
		}
	};
	if (dismissed) return null;
	return (
		<section className="overflow-hidden rounded-2xl border border-(--border) bg-(--background-elevated) p-5 sm:p-6">
			<div className="flex items-start gap-4">
				<div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-(--accent-subtle) text-(--accent)">
					<Sparkles className="size-5" aria-hidden="true" />
				</div>
				<div className="min-w-0 flex-1">
					<h2 className="font-display font-semibold text-xl">{entry.title}</h2>
					<p className="mt-1 text-(--foreground-muted) text-sm leading-6">
						{entry.summary}
					</p>
				</div>
			</div>
			<div className="mt-4 flex flex-wrap justify-end gap-2">
				<button type="button" className="btn btn-ghost" onClick={dismiss}>
					Dismiss
				</button>
				<Link
					to="/whats-new/$slug"
					params={{ slug: entry.slug }}
					className="btn btn-primary"
					onClick={dismiss}
				>
					Read what’s new
				</Link>
			</div>
		</section>
	);
}
