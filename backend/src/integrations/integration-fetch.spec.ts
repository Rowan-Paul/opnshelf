import { afterEach, expect, it, vi } from "vitest";
import { IntegrationUnavailable } from "./integration-error";
import {
	integrationFetch,
	integrationJson,
	isOutageStatus,
} from "./integration-fetch";

afterEach(() => vi.unstubAllGlobals());

it("reports a timeout or network failure as an outage without its message", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => {
			throw new TypeError("fetch failed: https://private.example/secret");
		}),
	);
	const failure = await integrationFetch("Fixture", "https://x.test").catch(
		(error: unknown) => error,
	);
	expect(failure).toBeInstanceOf(IntegrationUnavailable);
	expect((failure as Error).message).toBe(
		"Fixture could not be reached. Sync will retry.",
	);
});

it("reads an empty body as null and an unreadable body as an outage", async () => {
	expect(await integrationJson("Fixture", new Response(null))).toBeNull();
	expect(await integrationJson("Fixture", new Response('{"a":1}'))).toEqual({
		a: 1,
	});
	await expect(
		integrationJson("Fixture", new Response("<html>")),
	).rejects.toBeInstanceOf(IntegrationUnavailable);
});

it.each([
	[408, true],
	[500, true],
	[503, true],
	[404, false],
	[429, false],
	[401, false],
])("treats %i as an outage: %s", (status, outage) => {
	expect(isOutageStatus(status)).toBe(outage);
});
