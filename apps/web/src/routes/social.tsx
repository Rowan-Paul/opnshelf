import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout for Social (ADR 0032): the feed lives at the index route, with Find
// people and Circles as supporting pages underneath the same segment.
export const Route = createFileRoute("/social")({
	component: Outlet,
});
