import { listsControllerGetListOptions } from "@opnshelf/api";
import { createFileRoute } from "@tanstack/react-router";
import { setupApiClient } from "#/lib/api";
import { buildListPageMeta, ListsPage } from "./lists";

setupApiClient();

export const Route = createFileRoute("/lists/$listSlug")({
	loader: async ({ context, params }) => {
		return context.queryClient.ensureQueryData(
			listsControllerGetListOptions({
				path: { slug: params.listSlug },
			}),
		);
	},
	head: ({ loaderData, params }) => {
		const meta = buildListPageMeta(
			loaderData
				? {
						name: loaderData.name,
						description: loaderData.description,
						total: loaderData.total,
					}
				: {
						name: params.listSlug,
					},
		);

		return {
			meta: [
				{ title: meta.title },
				{
					name: "description",
					content: meta.description,
				},
			],
		};
	},
	component: ListDetailPage,
});

function ListDetailPage() {
	const { listSlug } = Route.useParams();

	return <ListsPage selectedListSlug={listSlug} />;
}
