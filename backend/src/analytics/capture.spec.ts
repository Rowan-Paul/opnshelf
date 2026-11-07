import { afterEach, expect, it, vi } from "vitest";
import { parseEnvironment } from "../config/env.schema";
import { captureProductEvent } from "./capture";

const production = {
	...parseEnvironment({}),
	NODE_ENV: "production" as const,
	BACKEND_PUBLIC_URL: "https://api.opnshelf.xyz",
	POSTHOG_KEY: "fixture-project-key",
};
afterEach(() => vi.unstubAllGlobals());

it.each([
	{ ...production, NODE_ENV: "test" as const },
	{ ...production, BACKEND_PUBLIC_URL: "https://staging-api.opnshelf.xyz" },
	{ ...production, POSTHOG_KEY: undefined },
])("never sends disabled or staging events", (env) => {
	const request = vi.fn();
	vi.stubGlobal("fetch", request);
	captureProductEvent(env, "did:plc:fixture", "account_created");
	expect(request).not.toHaveBeenCalled();
});

it("sends DID-linked EU events with a stable creation UUID and explicit platform", async () => {
	const request = vi.fn().mockResolvedValue(new Response());
	vi.stubGlobal("fetch", request);
	for (let i = 0; i < 2; i++)
		captureProductEvent(
			production,
			"did:plc:fixture",
			"account_created",
			{ method: "oauth" },
			"account_created:did:plc:fixture",
		);
	const bodies = request.mock.calls.map(([, options]) =>
		JSON.parse(options.body),
	);
	expect(request.mock.calls[0][0]).toBe("https://eu.i.posthog.com/i/v0/e/");
	expect(bodies[0]).toMatchObject({
		distinct_id: "did:plc:fixture",
		event: "account_created",
		properties: { method: "oauth", platform: "backend" },
	});
	expect(bodies[0].uuid).toMatch(/^[0-9a-f-]{36}$/);
	expect(bodies[0].uuid).toBe(bodies[1].uuid);
});

it("does not propagate unavailable ingestion", async () => {
	vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
	expect(() =>
		captureProductEvent(production, "did:plc:fixture", "integration_connected"),
	).not.toThrow();
	await new Promise((resolve) => setTimeout(resolve, 0));
});
