import { createFileRoute, redirect } from "@tanstack/react-router";

// The old /following page split into /activity (the feed) and /connections
// (people + circles). Keep the path alive for bookmarks → send to the feed.
export const Route = createFileRoute("/following")({
	beforeLoad: () => {
		throw redirect({ to: "/activity" });
	},
});
