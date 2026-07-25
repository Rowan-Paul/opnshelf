import { showsControllerGetShowDetailsOptions } from "@opnshelf/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useShowDetails } from "#/lib/hooks";
import { FullCredits } from "../../../../components/CreditsSections";

export const Route = createFileRoute("/shows/$showId/$showName/credits")({
	loader: async ({ context, params }) =>
		context.queryClient.ensureQueryData(
			showsControllerGetShowDetailsOptions({ path: { showId: params.showId } }),
		),
	head: ({ loaderData }) => ({
		meta: [{ title: `Cast & crew — ${loaderData?.name ?? "Show"} | Opnshelf` }],
	}),
	component: ShowCreditsPage,
});

function ShowCreditsPage() {
	const { showId, showName } = Route.useParams();
	const { data: show } = useShowDetails(showId);

	return (
		<div className="mx-auto min-h-screen max-w-5xl px-4 py-8">
			<Link
				to="/shows/$showId/$showName"
				params={{ showId, showName }}
				className="mb-6 inline-flex items-center gap-1 text-(--foreground-muted) text-sm hover:text-(--foreground)"
			>
				<ChevronLeft className="size-4" />
				{show?.name ?? "Back to show"}
			</Link>
			<h1 className="mb-8 text-display-2">Cast & crew</h1>
			<FullCredits mediaType="show" mediaId={showId} />
		</div>
	);
}
