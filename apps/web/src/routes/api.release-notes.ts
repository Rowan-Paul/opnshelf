import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/release-notes")({
	server: {
		handlers: {
			GET: async () => {
				const { publishedReleaseNotes } = await import(
					"#/lib/release-notes.server"
				);
				return Response.json(publishedReleaseNotes(), {
					headers: {
						"Cache-Control": "no-store",
						"Access-Control-Allow-Origin": "*",
					},
				});
			},
		},
	},
});
