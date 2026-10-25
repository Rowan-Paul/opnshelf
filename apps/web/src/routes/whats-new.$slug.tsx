import { createFileRoute, notFound } from "@tanstack/react-router";
import {
	ReleaseNotesPage,
	ReleaseNotesSkeleton,
} from "#/components/release-notes/ReleaseNotes";
import { getPageMeta, getSharingImageUrl } from "#/lib/media-meta";
import { releaseNotesOptions } from "#/lib/release-notes-query";
export const Route = createFileRoute("/whats-new/$slug")({
	loader: async ({ context, params }) => {
		const notes = await context.queryClient.ensureQueryData(
			releaseNotesOptions(),
		);
		const entry = notes.find((note) => note.slug === params.slug);
		if (!entry) throw notFound();
		return entry;
	},
	head: ({ loaderData, match }) => ({
		meta: getPageMeta(
			{
				title: `${loaderData?.title ?? "Release Notes"} | Opnshelf`,
				description: loaderData?.summary ?? "Opnshelf Release Notes",
				imageUrl: loaderData
					? getSharingImageUrl({ release: loaderData.slug })
					: undefined,
			},
			match.pathname,
		),
	}),
	pendingComponent: ReleaseNotesSkeleton,
	notFoundComponent: Detail,
	errorComponent: Detail,
	component: Detail,
});
function Detail() {
	const { slug } = Route.useParams();
	return <ReleaseNotesPage slug={slug} />;
}
