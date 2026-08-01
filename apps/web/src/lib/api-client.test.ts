import { usersControllerGetMyCurrentTraktImport } from "@opnshelf/api";
import { describe, expect, it, vi } from "vitest";

describe("api client", () => {
	it("reads a bodiless 200 as null, not an empty object", async () => {
		// What Nest sends when a controller returns `null`. Left as `{}`, every
		// `if (job)` in the app passes and the next field read throws.
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

		const { data } = await usersControllerGetMyCurrentTraktImport();

		expect(data).toBeNull();
	});
});
