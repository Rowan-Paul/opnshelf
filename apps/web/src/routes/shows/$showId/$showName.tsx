import { createFileRoute, Outlet } from "@tanstack/react-router";

// This is a layout route - it only renders the outlet
// The actual show/season/episode content is rendered by child routes
export const Route = createFileRoute("/shows/$showId/$showName")({
	component: ShowLayout,
});

function ShowLayout() {
	return <Outlet />;
}
