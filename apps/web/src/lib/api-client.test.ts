import { traktSyncControllerStatus } from "@opnshelf/api";
import { describe, expect, it, vi } from "vitest";

describe("api client", () => {
	it("reads a bodiless 200 as null, not an empty object", async () => {
		// An empty JSON response must remain null.
		vi.stubGlobal(
			"fetch",
			async () =>
				new Response(null, {
					status: 200,
					headers: {
						"content-type": "application/json",
						"content-length": "0",
					},
				}),
		);

		const { data } = await traktSyncControllerStatus();

		expect(data).toBeNull();
	});
});
