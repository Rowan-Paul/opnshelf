import {
	client,
	describeMutationFailure,
	traktSyncControllerStatus,
} from "@opnshelf/api";
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

it.each([
	["Network request failed", "Error", "network"],
	["private-token someone@example.com", "AbortError", "aborted"],
	["private-token someone@example.com", "TimeoutError", "timeout"],
	["Network request failed: private-token", "Error", "unknown"],
])("reports categorical diagnostics for %s without sending raw text", async (message, name, reason) => {
	const error = Object.assign(new Error(message), { name });
	vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
	let failure: unknown;
	try {
		await traktSyncControllerStatus({ throwOnError: true });
	} catch (caught) {
		failure = caught;
	}
	const report = describeMutationFailure(failure, ["trakt-sync", "status"]);
	expect(report?.properties).toMatchObject({
		failure_reason: reason,
		request_created: true,
		response_received: false,
	});
	expect(JSON.stringify(report)).not.toMatch(
		/private-token|someone@example.com/,
	);
});

it("distinguishes response parsing failures without reporting the response body", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue(
			new Response("private-token someone@example.com", {
				headers: { "content-type": "application/json" },
			}),
		),
	);
	let failure: unknown;
	try {
		await client.get({ url: "/fixture", throwOnError: true });
	} catch (caught) {
		failure = caught;
	}
	const report = describeMutationFailure(failure, ["fixture"]);
	expect(report?.properties).toMatchObject({
		failure_reason: "unknown",
		request_created: true,
		response_received: true,
	});
	expect(JSON.stringify(report)).not.toMatch(
		/private-token|someone@example.com/,
	);
});

it("distinguishes failure before Request construction", async () => {
	let failure: unknown;
	try {
		await client.post({
			url: "/fixture",
			throwOnError: true,
			requestValidator: async () => {
				throw new Error("private-token someone@example.com");
			},
		});
	} catch (caught) {
		failure = caught;
	}
	const report = describeMutationFailure(failure, ["fixture"]);
	expect(report?.properties).toMatchObject({
		failure_reason: "unknown",
		request_created: false,
		response_received: false,
	});
	expect(JSON.stringify(report)).not.toMatch(
		/private-token|someone@example.com/,
	);
});
