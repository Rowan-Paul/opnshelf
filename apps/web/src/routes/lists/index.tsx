import { createFileRoute } from "@tanstack/react-router";
import { LISTS_PAGE_DESCRIPTION, LISTS_PAGE_TITLE, ListsPage } from "../lists";

export const Route = createFileRoute("/lists/")({
	component: ListsIndexPage,
	head: () => ({
		meta: [
			{ title: LISTS_PAGE_TITLE },
			{
				name: "description",
				content: LISTS_PAGE_DESCRIPTION,
			},
		],
	}),
});

function ListsIndexPage() {
	return <ListsPage />;
}
