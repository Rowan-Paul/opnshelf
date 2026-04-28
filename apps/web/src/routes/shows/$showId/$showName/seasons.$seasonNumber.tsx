import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/shows/$showId/$showName/seasons/$seasonNumber",
)({
	component: SeasonLayout,
});

function SeasonLayout() {
	return <Outlet />;
}
