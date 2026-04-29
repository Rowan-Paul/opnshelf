import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/profile/$handle/lists")({
	component: ListsLayout,
});

function ListsLayout() {
	return <Outlet />;
}
