import { moviesControllerGetMovieDetailsOptions } from "@opnshelf/api";
import type { QueryClient } from "@tanstack/react-query";

export const movieDetailRouteId = "/movies/$movieId/$movieName/";

type MovieLoaderDiagnostics = {
	movie_loader_runtime: "browser" | "server";
	movie_loader_stage: "before_fetch" | "fetch" | "after_response";
	api_status?: number;
	api_request_id?: string;
	api_content_type?: "json" | "html" | "other" | "missing";
};

const browserDiagnostics = new WeakMap<Error, MovieLoaderDiagnostics>();

export async function loadMovieDetails(
	queryClient: QueryClient,
	movieId: string,
) {
	let stage: MovieLoaderDiagnostics["movie_loader_stage"] = "before_fetch";
	let response: Response | undefined;

	try {
		return await queryClient.ensureQueryData(
			moviesControllerGetMovieDetailsOptions({
				path: { movieId },
				fetch: async (input, init) => {
					stage = "fetch";
					response = undefined;
					response = await globalThis.fetch(input, init);
					stage = "after_response";
					return response;
				},
			}),
		);
	} catch (error) {
		if (error instanceof SyntaxError) {
			const diagnostics: MovieLoaderDiagnostics = {
				movie_loader_runtime:
					typeof window === "undefined" ? "server" : "browser",
				movie_loader_stage: stage,
			};
			if (response) {
				const requestId = response.headers.get("x-request-id");
				if (
					requestId &&
					/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requestId)
				) {
					diagnostics.api_request_id = requestId;
				}
				diagnostics.api_status = response.status;
				diagnostics.api_content_type = responseContentType(response);
			}
			if (diagnostics.movie_loader_runtime === "server") {
				// TanStack's SSR error serializer only sends the message to the browser.
				console.warn("movie_loader_syntax_error", {
					...diagnostics,
					release: webRelease(),
				});
			} else if (!browserDiagnostics.has(error)) {
				browserDiagnostics.set(error, diagnostics);
			}
		}
		throw error;
	}
}

export function movieBoundaryDiagnostics(routeId: string, error: unknown) {
	if (
		routeId !== movieDetailRouteId ||
		!(error instanceof Error) ||
		(!(error instanceof SyntaxError) &&
			error.message !== "Unexpected end of input")
	) {
		return {};
	}
	return {
		release: webRelease(),
		...(browserDiagnostics.get(error) ?? {
			movie_loader_stage: "unattributed",
		}),
	};
}

function webRelease(): string | undefined {
	const release = import.meta.env.VITE_RELEASE_SHA;
	return typeof release === "string" && /^[a-f0-9]{7,40}$/i.test(release)
		? release
		: undefined;
}

function responseContentType(
	response: Response,
): MovieLoaderDiagnostics["api_content_type"] {
	const mime = response.headers
		.get("content-type")
		?.split(";")[0]
		?.trim()
		.toLowerCase();
	if (!mime) return "missing";
	if (mime === "application/json" || mime.endsWith("+json")) return "json";
	if (mime === "text/html") return "html";
	return "other";
}
