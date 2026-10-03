import { createFileRoute, notFound } from "@tanstack/react-router";
import {
	ReleaseNotesPage,
	ReleaseNotesSkeleton,
} from "#/components/release-notes/ReleaseNotes";
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
	head: ({ loaderData }) => ({
		meta: [
			{ title: `${loaderData?.title ?? "Release note"} | Opnshelf` },
			{
				name: "description",
				content: loaderData?.summary ?? "Opnshelf Release Notes",
			},
		],
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
