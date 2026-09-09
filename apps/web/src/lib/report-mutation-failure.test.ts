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
			mutation_key: "users/me/profile/avatar/upload",
			http_status: 400,
			error_name: "Error",
		});
	});

	it("reports network failures without a status", async () => {
		await failMutation(["reviews", "create"], new TypeError("Failed to fetch"));

		expect(mocks.captureException).toHaveBeenCalledWith(
			expect.objectContaining({ message: "reviews/create failed" }),
			{
				mutation_key: "reviews/create",
				http_status: null,
				error_name: "TypeError",
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
