import { createFileRoute } from "@tanstack/react-router";
import {
	ReleaseNotesPage,
	ReleaseNotesSkeleton,
} from "#/components/release-notes/ReleaseNotes";
import { getPageMeta } from "#/lib/media-meta";
import { releaseNotesOptions } from "#/lib/release-notes-query";
export const Route = createFileRoute("/whats-new/")({
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(releaseNotesOptions()),
	head: ({ match }) => ({
		meta: getPageMeta(
			{
				title: "What’s new | Opnshelf",
				description: "The latest Opnshelf improvements and how to use them.",
			},
			match.pathname,
		),
	}),
	pendingComponent: ReleaseNotesSkeleton,
	errorComponent: () => <ReleaseNotesPage />,
	component: () => <ReleaseNotesPage />,
});
