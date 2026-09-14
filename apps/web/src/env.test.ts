// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

it("loads the SSR signing secret from runtime and permits it to be unset", async () => {
	vi.stubEnv("SSR_RATE_LIMIT_SECRET", "");
	expect((await import("./env")).env.SSR_RATE_LIMIT_SECRET).toBeUndefined();
	vi.resetModules();
	const value = "test-only-runtime-secret-of-at-least-32-characters";
	vi.stubEnv("SSR_RATE_LIMIT_SECRET", value);
	expect((await import("./env")).env.SSR_RATE_LIMIT_SECRET).toBe(value);
});

it("rejects a configured SSR signing secret shorter than 32 characters", async () => {
	vi.stubEnv("SSR_RATE_LIMIT_SECRET", "too-short");
	await expect(import("./env")).rejects.toThrow(
		"Invalid environment variables",
	);
});
