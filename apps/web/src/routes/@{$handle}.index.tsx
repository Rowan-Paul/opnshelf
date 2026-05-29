import { createFileRoute, redirect } from "@tanstack/react-router";

// The publication base URL (opnshelf.xyz/@<handle>, per ADR-0003) is a data
// pointer, not a blog index — opnshelf renders individual reviews, not a
// publication landing page. Send a bare /@<handle> hit to the user's profile.
export const Route = createFileRoute("/@{$handle}/")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/profile/$handle",
			params: { handle: params.handle },
		});
	},
});
