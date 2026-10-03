import { createFileRoute } from "@tanstack/react-router";
import {
	ReleaseNotesPage,
	ReleaseNotesSkeleton,
} from "#/components/release-notes/ReleaseNotes";
import { releaseNotesOptions } from "#/lib/release-notes-query";
export const Route = createFileRoute("/whats-new/")({
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(releaseNotesOptions()),
	head: () => ({
		meta: [
			{ title: "What’s new | Opnshelf" },
			{
				name: "description",
				content: "The latest Opnshelf improvements and how to use them.",
			},
		],
	}),
	pendingComponent: ReleaseNotesSkeleton,
	errorComponent: () => <ReleaseNotesPage />,
	component: () => <ReleaseNotesPage />,
});
