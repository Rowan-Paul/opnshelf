import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { DefaultErrorComponent } from "./ErrorBoundary";

const { captureException, invalidate } = vi.hoisted(() => ({
	captureException: vi.fn(),
	invalidate: vi.fn(),
}));
vi.mock("#/integrations/posthog/provider", () => ({
	posthog: { captureException },
}));
vi.mock("@tanstack/react-router", () => ({
	useRouter: () => ({
		invalidate,
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

it.each([
	"error loading dynamically imported module: https://opnshelf.xyz/assets/settings-old.js",
	"Failed to fetch dynamically imported module: https://opnshelf.xyz/assets/settings-old.js",
	"Importing a module script failed.",
])("reloads the document to recover a cached module rejection: %s", (message) => {
	const reload = vi.fn();
	vi.stubGlobal("window", { location: { reload } });
	const reset = vi.fn();
	try {
		render(
			<DefaultErrorComponent error={new TypeError(message)} reset={reset} />,
		);
		fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
		expect(reload).toHaveBeenCalledOnce();
		expect(reset).not.toHaveBeenCalled();
	} finally {
		vi.unstubAllGlobals();
	}
});
it("resets ordinary route errors without reloading", () => {
	const reset = vi.fn();
	render(
		<DefaultErrorComponent error={new Error("Request failed")} reset={reset} />,
	);
	fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
	expect(reset).toHaveBeenCalledOnce();
});
