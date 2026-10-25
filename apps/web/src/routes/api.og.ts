import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/og")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const { openGraphImageResponse } = await import(
					"#/lib/open-graph-image.server"
				);
				return openGraphImageResponse(request);
			},
		},
	},
});
