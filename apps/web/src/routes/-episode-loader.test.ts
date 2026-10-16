import { QueryClient } from "@tanstack/react-query";
import { isNotFound } from "@tanstack/react-router";
import { expect, it, vi } from "vitest";
import { Route } from "./shows/$showId/$showName/seasons.$seasonNumber.episodes.$episodeNumber";

it.each([
	404, 500,
])("handles an episode loader HTTP %s without hiding server failures", async (statusCode) => {
	const queryClient = new QueryClient();
	const error = {
		statusCode,
		message: statusCode === 404 ? "Season not found" : "Internal server error",
	};
	vi.spyOn(queryClient, "ensureQueryData")
		.mockResolvedValueOnce({})
		.mockRejectedValueOnce(error);
	const loader = Route.options.loader;
	if (typeof loader !== "function") throw new Error("Expected episode loader");
	const result = loader({
		context: { queryClient },
		params: {
			showId: "32637",
			showName: "example",
			seasonNumber: "1",
			episodeNumber: "38",
		},
	} as Parameters<typeof loader>[0]);
	if (statusCode === 404) await expect(result).rejects.toSatisfy(isNotFound);
	else await expect(result).rejects.toBe(error);
	queryClient.clear();
});
