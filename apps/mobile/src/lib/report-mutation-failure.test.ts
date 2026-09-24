import { client } from "@opnshelf/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	captureException: vi.fn(),
	posthog: null as { captureException: (...args: unknown[]) => void } | null,
}));

vi.mock("@/lib/posthog", () => ({
	get posthog() {
		return mocks.posthog;
	},
}));

import { queryClient } from "@/lib/query-client";

async function failMutation(
	mutationKey: unknown[] | undefined,
	error: unknown,
) {
	const mutation = queryClient.getMutationCache().build(queryClient, {
		mutationKey,
		mutationFn: async () => {
			throw error;
		},
		// A per-mutation onError (the toast in the app) must not swallow the
		// cache-level report.
		onError: () => undefined,
	});
	await mutation.execute(undefined).catch(() => undefined);
}

describe("shared QueryClient mutation failure reporting", () => {
	beforeEach(() => {
		mocks.captureException.mockClear();
		mocks.posthog = { captureException: mocks.captureException };
	});

	it("reports a failed mutation to PostHog with categorical properties only", async () => {
		const serverError = Object.assign(new Error("Too many parts"), {
			status: 400,
			requestId: "private details",
		});

		await failMutation(
			["users", "me", "profile", "avatar", "upload"],
			serverError,
		);

		expect(mocks.captureException).toHaveBeenCalledTimes(1);
		const [error, properties] = mocks.captureException.mock.calls[0];
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("MutationFailedError");
		expect(error.message).toBe(
			"users/me/profile/avatar/upload failed with HTTP 400",
		);
		expect(error.message).not.toContain("Too many parts");
		expect(properties).toEqual({
			mutation_key: "users/me/profile/avatar/upload",
			http_status: 400,
			error_name: "Error",
			request_id: null,
		});
	});

	it("reports the request ID returned with an API failure", async () => {
		const error = await client
			.get({
				url: "/lists/example/items/movie/123",
				throwOnError: true,
				fetch: async () =>
					new Response(JSON.stringify({ statusCode: 500 }), {
						status: 500,
						headers: {
							"X-Request-ID": "1bb20dbc-dbf4-4636-9919-c0dd15d04084",
						},
					}),
			})
			.catch((failure: unknown) => failure);
		await failMutation(["lists", "example", "removeItem"], error);

		expect(mocks.captureException).toHaveBeenCalledWith(
			expect.any(Error),
			expect.objectContaining({
				http_status: 500,
				request_id: "1bb20dbc-dbf4-4636-9919-c0dd15d04084",
			}),
		);
	});

	it("reports network failures without a status", async () => {
		await failMutation(["reviews", "create"], new TypeError("Failed to fetch"));

		expect(mocks.captureException).toHaveBeenCalledWith(
			expect.objectContaining({ message: "reviews/create failed" }),
			{
				mutation_key: "reviews/create",
				http_status: null,
				error_name: "TypeError",
				request_id: null,
			},
		);
	});

	it("skips 401s, which the unauthorized flow already handles", async () => {
		await failMutation(
			["users", "me", "profile", "update"],
			Object.assign(new Error("Unauthorized"), { statusCode: 401 }),
		);
		await failMutation(
			["users", "me", "profile", "update"],
			Object.assign(new Error("Unauthorized"), {
				status: 400,
				statusCode: 401,
			}),
		);

		expect(mocks.captureException).not.toHaveBeenCalled();
	});

	it("does nothing when PostHog is not constructed for this environment", async () => {
		mocks.posthog = null;

		await failMutation(
			["users", "me", "profile", "update"],
			Object.assign(new Error("Bad Request"), { status: 400 }),
		);

		expect(mocks.captureException).not.toHaveBeenCalled();
	});
});
