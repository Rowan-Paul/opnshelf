import { Logger } from "@nestjs/common";
import { afterEach, expect, it, vi } from "vitest";
import { parseEnvironment } from "../config/env.schema";
import { captureProductEvent } from "./capture";

const production = {
	...parseEnvironment({}),
	NODE_ENV: "production" as const,
	BACKEND_PUBLIC_URL: "https://api.opnshelf.xyz",
	POSTHOG_KEY: "fixture-project-key",
};
afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	vi.useRealTimers();
});

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

it("keeps deduplication fields stable even when capture runs at different times", async () => {
	vi.useFakeTimers();
	const occurredAt = new Date("2026-10-01T12:00:00.000Z");
	const request = vi.fn().mockResolvedValue(new Response());
	vi.stubGlobal("fetch", request);
	for (let i = 0; i < 2; i++) {
		vi.setSystemTime(new Date(occurredAt.getTime() + i * 60_000));
		captureProductEvent(
			production,
			"did:plc:fixture",
			"account_created",
			{ method: "oauth" },
			"account_created:did:plc:fixture",
			occurredAt,
		);
	}
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
	expect(bodies[0].timestamp).toBe(occurredAt.toISOString());
	expect(bodies[0]).toMatchObject({
		timestamp: bodies[1].timestamp,
		event: bodies[1].event,
		distinct_id: bodies[1].distinct_id,
	});
});

it("does not propagate unavailable ingestion", async () => {
	vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
	expect(() =>
		captureProductEvent(production, "did:plc:fixture", "integration_connected"),
	).not.toThrow();
	await new Promise((resolve) => setTimeout(resolve, 0));
});

it("logs rejected capture statuses without payloads or response content", async () => {
	const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
	vi.stubGlobal(
		"fetch",
		vi
			.fn()
			.mockResolvedValue(new Response("private response", { status: 401 })),
	);
	captureProductEvent(production, "did:plc:private", "account_created");
	await vi.waitFor(() =>
		expect(warn).toHaveBeenCalledWith("PostHog capture rejected with HTTP 401"),
	);
	expect(JSON.stringify(warn.mock.calls)).not.toMatch(
		/fixture-project-key|private/,
	);
});
