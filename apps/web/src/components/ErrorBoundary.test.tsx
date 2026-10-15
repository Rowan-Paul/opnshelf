import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { DefaultErrorComponent } from "./ErrorBoundary";

const captureException = vi.hoisted(() => vi.fn());
vi.mock("#/integrations/posthog/provider", () => ({
	posthog: { captureException },
}));
vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({
		invalidate: vi.fn(),
		history: { back: vi.fn() },
		state: {
			matches: [
				{ routeId: "__root__" },
				{
					routeId:
						"/shows/$showId/$showName/seasons/$seasonNumber/episodes/$episodeNumber",
				},
			],
		},
	}),
	Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
afterEach(() => {
	cleanup();
	captureException.mockClear();
});
it("names failed pages using the route template without capturing path values", () => {
	const error = { statusCode: 500, message: "Internal server error" };
	render(<DefaultErrorComponent error={error} />);
	expect(captureException).toHaveBeenCalledWith(error, {
		error_boundary: "tanstack_router",
		$issue_name:
			"Page failed: /shows/$showId/$showName/seasons/$seasonNumber/episodes/$episodeNumber (HTTP 500)",
	});
});
