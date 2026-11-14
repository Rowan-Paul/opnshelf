import { client } from "@opnshelf/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	captureException: vi.fn(),
	posthog: null as { captureException: (...args: unknown[]) => void } | null,
	pathname: null as string | null,
	appState: "active",
	listeners: new Set<(state: string) => void>(),
}));

vi.mock("@/lib/posthog", () => ({
	get posthog() {
		return mocks.posthog;
	},
	release: "c94eadea",
	getCurrentPathname: () => mocks.pathname,
}));

vi.mock("react-native", () => ({
	AppState: {
		get currentState() {
			return mocks.appState;
		},
		addEventListener: (_event: string, listener: (state: string) => void) => {
			mocks.listeners.add(listener);
			return { remove: () => mocks.listeners.delete(listener) };
		},
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

beforeEach(() => {
	mocks.captureException.mockClear();
	mocks.posthog = { captureException: mocks.captureException };
	mocks.pathname = null;
	mocks.appState = "active";
	mocks.listeners.clear();
});

describe("shared QueryClient mutation failure reporting", () => {
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
			$exception_fingerprint:
				"MutationFailedError: users/me/profile/avatar/upload failed with HTTP 400",
			mutation_key: "users/me/profile/avatar/upload",
			http_status: 400,
			error_name: "Error",
			failure_reason: "http",
			request_created: null,
			response_received: null,
			request_id: null,
			error_code: null,
			api_operation: null,
			route: null,
			release: "c94eadea",
			app_state_at_start: "active",
			app_state_at_failure: "active",
			app_backgrounded_while_pending: false,
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

	it("forwards safe diagnostics from an API failure and nothing secret", async () => {
		mocks.pathname = "/verify-email/someone@example.com?code=482913";
		const error = await client
			.post({
				url: "/auth/verify-email",
				body: { code: "482913", email: "someone@example.com" },
				headers: { Authorization: "Bearer secret-token" },
				throwOnError: true,
				fetch: async () =>
					new Response(
						JSON.stringify({
							statusCode: 400,
							code: "EMAIL_CODE_EXPIRED",
							message: "Code 482913 for someone@example.com has expired",
							accessJwt: "secret-token",
						}),
						{
							status: 400,
							headers: {
								"X-Request-ID": "1bb20dbc-dbf4-4636-9919-c0dd15d04084",
							},
						},
					),
			})
			.catch((failure: unknown) => failure);
		await failMutation(["auth", "verify-email"], error);

		const [reported, properties] = mocks.captureException.mock.calls[0];
		expect(properties).toEqual({
			$exception_fingerprint:
				"MutationFailedError: auth/verify-email failed with HTTP 400",
			mutation_key: "auth/verify-email",
			http_status: 400,
			error_name: "object",
			failure_reason: "http",
			request_created: true,
			response_received: true,
			request_id: "1bb20dbc-dbf4-4636-9919-c0dd15d04084",
			error_code: "EMAIL_CODE_EXPIRED",
			api_operation: "POST /auth/verify-email",
			route: "/verify-email",
			release: "c94eadea",
			app_state_at_start: "active",
			app_state_at_failure: "active",
			app_backgrounded_while_pending: false,
		});
		const sent = JSON.stringify([reported.message, properties]);
		expect(sent).not.toMatch(/482913|secret-token|example\.com|Bearer/);
	});

	it("drops diagnostics that are not in their expected shape", async () => {
		await failMutation(["auth", "verify-email"], {
			statusCode: 400,
			code: "someone@example.com",
			requestId: "secret-token",
			apiOperation: "POST /auth/verify-email?code=482913",
			apiRequestCreated: "secret-token",
			apiResponseReceived: "someone@example.com",
		});

		const [, properties] = mocks.captureException.mock.calls[0];
		expect(properties).toMatchObject({
			error_code: null,
			request_id: null,
			api_operation: null,
			request_created: null,
			response_received: null,
		});
		expect(JSON.stringify(properties)).not.toMatch(
			/482913|secret-token|example\.com/,
		);
	});

	it("reports network failures without a status", async () => {
		await failMutation(["reviews", "create"], new TypeError("Failed to fetch"));

		expect(mocks.captureException).toHaveBeenCalledWith(
			expect.objectContaining({ message: "reviews/create failed" }),
			{
				$exception_fingerprint: "MutationFailedError: reviews/create failed",
				mutation_key: "reviews/create",
				http_status: null,
				error_name: "TypeError",
				failure_reason: "network",
				request_created: null,
				response_received: null,
				request_id: null,
				error_code: null,
				api_operation: null,
				route: null,
				release: "c94eadea",
				app_state_at_start: "active",
				app_state_at_failure: "active",
				app_backgrounded_while_pending: false,
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

it("records backgrounding during a pending mutation and removes its lifecycle listener", async () => {
	let fail!: (error: Error) => void;
	const mutation = queryClient.getMutationCache().build(queryClient, {
		mutationKey: ["popfeed-sync", "issues", "resolve"],
		mutationFn: () =>
			new Promise<void>((_resolve, reject) => {
				fail = reject;
			}),
	});
	const result = mutation.execute(undefined).catch(() => undefined);
	await vi.waitFor(() => expect(fail).toBeDefined());
	mocks.appState = "background";
	for (const listener of mocks.listeners) listener("background");
	mocks.appState = "active";
	for (const listener of mocks.listeners) listener("active");
	fail(new Error("private-token someone@example.com"));
	await result;
	expect(mocks.captureException).toHaveBeenCalledWith(
		expect.any(Error),
		expect.objectContaining({
			failure_reason: "unknown",
			app_state_at_start: "active",
			app_state_at_failure: "active",
			app_backgrounded_while_pending: true,
		}),
	);
	expect(mocks.listeners.size).toBe(0);
	expect(JSON.stringify(mocks.captureException.mock.calls)).not.toMatch(
		/private-token|someone@example.com/,
	);
});

it("cleans up successful mutations without reporting an error", async () => {
	mocks.captureException.mockClear();
	const mutation = queryClient.getMutationCache().build(queryClient, {
		mutationFn: async () => {
			expect(mocks.listeners.size).toBe(1);
		},
	});
	await mutation.execute(undefined);
	expect(mocks.listeners.size).toBe(0);
	expect(mocks.captureException).not.toHaveBeenCalled();
});

it("records a mutation started in the background without needing a transition", async () => {
	mocks.appState = "background";
	await failMutation(["fixture"], new Error("Network request timed out"));
	expect(mocks.captureException).toHaveBeenCalledWith(
		expect.any(Error),
		expect.objectContaining({
			failure_reason: "timeout",
			app_state_at_start: "background",
			app_state_at_failure: "background",
			app_backgrounded_while_pending: true,
		}),
	);
	expect(mocks.listeners.size).toBe(0);
});
