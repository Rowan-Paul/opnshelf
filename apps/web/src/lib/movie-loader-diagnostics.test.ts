import { QueryClient } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import {
	loadMovieDetails,
	movieBoundaryDiagnostics,
	movieDetailRouteId,
} from "./movie-loader-diagnostics";

const requestId = "6c754d62-71cf-4bf0-91cf-442aab278187";
const release = "96ff1c7e";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

it.each([
	"browser",
	"server",
] as const)("records only categorical response metadata for invalid Movie JSON on the %s", async (runtime) => {
	if (runtime === "server") vi.stubGlobal("window", undefined);
	vi.stubEnv("VITE_RELEASE_SHA", release);
	vi.stubGlobal(
		"fetch",
		async () =>
			new Response('{"title":"do not capture', {
				headers: {
					"content-type": "application/json",
					"x-request-id": requestId,
				},
			}),
	);
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const error = await loadMovieDetails(queryClient, "792").catch(
		(error: unknown) => error,
	);
	expect(error).toBeInstanceOf(SyntaxError);
	const diagnostics = {
		movie_loader_runtime: runtime,
		movie_loader_stage: "after_response",
		api_status: 200,
		api_request_id: requestId,
		api_content_type: "json",
		release,
	};
	if (runtime === "server") {
		expect(warn.mock.calls).toEqual([
			["movie_loader_syntax_error", diagnostics],
		]);
	} else {
		expect(warn).not.toHaveBeenCalled();
		expect(movieBoundaryDiagnostics(movieDetailRouteId, error)).toEqual(
			diagnostics,
		);
	}
});

it("marks a Movie syntax error without matching loader context as unattributed", () => {
	vi.stubEnv("VITE_RELEASE_SHA", release);
	const error = new Error("Unexpected end of input");
	expect(movieBoundaryDiagnostics(movieDetailRouteId, error)).toEqual({
		movie_loader_stage: "unattributed",
		release,
	});
	expect(movieBoundaryDiagnostics("/people", error)).toEqual({});
});
