import { createFileRoute, redirect } from "@tanstack/react-router";

// Trakt's OAuth callback and older links still land here (ADR 0051).
export const Route = createFileRoute("/trakt-sync")({
	validateSearch: (
		search: Record<string, unknown>,
	): { connection?: string } => ({
		connection:
			typeof search.connection === "string" ? search.connection : undefined,
	}),
	beforeLoad: ({ search }) => {
		throw redirect({
			to: "/integrations/$provider",
			params: { provider: "trakt" },
			search,
			replace: true,
		});
	},
});
