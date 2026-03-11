import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/profile")({
	component: ProfileRouteOutlet,
});

function ProfileRouteOutlet() {
	return <Outlet />;
}
