import { client } from "@opnshelf/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	captureException: vi.fn(),
	enabled: true,
}));

vi.mock("#/integrations/posthog/provider", () => ({
	posthog: { captureException: mocks.captureException },
	get isPostHogEnabled() {
		return mocks.enabled;
	},
}));

import { getContext } from "#/integrations/tanstack-query/root-provider";

async function failMutation(
	mutationKey: unknown[] | undefined,
	error: unknown,
) {
	const { queryClient } = getContext();
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

describe("app QueryClient mutation failure reporting", () => {
	beforeEach(() => {
		mocks.captureException.mockClear();
		mocks.enabled = true;
	});

	it("reports a failed mutation to PostHog with categorical properties only", async () => {
		const serverError = Object.assign(new Error("Too many parts"), {
			status: 400,
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
			route: "/",
			release: null,
		});
	});

	it("forwards safe diagnostics from an API failure and nothing secret", async () => {
		vi.stubEnv("VITE_RELEASE_SHA", "c94eadeac1c820d9809e74bc20e0563c44b76702");
		window.history.pushState(
			{},
			"",
			"/onboarding/someone@example.com?code=482913&token=secret-token",
		);
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
		vi.unstubAllEnvs();
		window.history.pushState({}, "", "/");

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
			route: "/onboarding",
			release: "c94eadeac1c820d9809e74bc20e0563c44b76702",
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
				route: "/",
				release: null,
			},
		);
	});

	it("labels mutations without a key so the gap is visible", async () => {
		await failMutation(undefined, new Error("boom"));

		expect(mocks.captureException).toHaveBeenCalledWith(
			expect.objectContaining({ message: "unknown failed" }),
			expect.objectContaining({ mutation_key: "unknown" }),
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

	it("does nothing when PostHog is disabled for this origin", async () => {
		mocks.enabled = false;

		await failMutation(
			["users", "me", "profile", "update"],
			Object.assign(new Error("Bad Request"), { status: 400 }),
		);

		expect(mocks.captureException).not.toHaveBeenCalled();
	});
});
