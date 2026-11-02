import { createFileRoute, redirect } from "@tanstack/react-router";

// Older links to Trakt Sync's Needs attention list still land here (ADR 0051).
export const Route = createFileRoute("/trakt-sync_/attention")({
	beforeLoad: () => {
		throw redirect({
			to: "/integrations/$provider/attention",
			params: { provider: "trakt" },
			replace: true,
		});
	},
});
