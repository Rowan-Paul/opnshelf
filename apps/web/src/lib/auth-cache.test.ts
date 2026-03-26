// @vitest-environment jsdom

import { authControllerMeQueryKey } from "@opnshelf/api";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { publishSignedOutAuthState } from "./auth-cache";

describe("publishSignedOutAuthState", () => {
	it("publishes a signed-out auth state and invalidates the auth query", async () => {
		const queryClient = new QueryClient();
		const queryKey = authControllerMeQueryKey();
		const cancelQueries = vi.spyOn(queryClient, "cancelQueries");
		const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

		queryClient.setQueryData(queryKey, {
			did: "did:plc:alice",
			handle: "alice",
		});

		await publishSignedOutAuthState(queryClient);

		expect(cancelQueries).toHaveBeenCalledWith({ queryKey });
		expect(queryClient.getQueryData(queryKey)).toBeNull();
		expect(invalidateQueries).toHaveBeenCalledWith({ queryKey });
	});
});
