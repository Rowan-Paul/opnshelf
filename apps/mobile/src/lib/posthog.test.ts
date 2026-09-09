import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	PostHog: vi.fn(),
	env: {
		apiUrl: "https://api.opnshelf.xyz",
		posthogApiKey: "test-project-key" as string | undefined,
		posthogHost: "https://eu.i.posthog.com",
	},
}));

vi.mock("posthog-react-native", () => ({ default: mocks.PostHog }));
vi.mock("./env", () => ({ env: mocks.env }));

beforeEach(() => {
	vi.resetModules();
	mocks.PostHog.mockClear();
	mocks.env.apiUrl = "https://api.opnshelf.xyz";
	mocks.env.posthogApiKey = "test-project-key";
	vi.stubGlobal("__DEV__", false);
	vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("PostHog environment isolation", () => {
	it.each([
		"https://api.staging.opnshelf.xyz",
		"http://127.0.0.1:3001",
		"https://api.opnshelf.xyz.example.com",
		"http://api.opnshelf.xyz",
		"invalid-url",
	])("does not construct the SDK for %s even with a real key", async (url) => {
		mocks.env.apiUrl = url;
		const { posthog } = await import("./posthog");
		expect(posthog).toBeNull();
		expect(mocks.PostHog).not.toHaveBeenCalled();
		expect(console.warn).not.toHaveBeenCalled();
	});

	it.each([
		"https://api.opnshelf.xyz",
		"https://api.opnshelf.xyz/",
	])("constructs the SDK for a production build using %s", async (url) => {
		mocks.env.apiUrl = url;
		await import("./posthog");
		expect(mocks.PostHog).toHaveBeenCalledWith(
			"test-project-key",
			expect.objectContaining({ host: mocks.env.posthogHost }),
		);
	});

	it("does not construct the SDK in development with production config", async () => {
		vi.stubGlobal("__DEV__", true);
		const { posthog } = await import("./posthog");
		expect(posthog).toBeNull();
		expect(mocks.PostHog).not.toHaveBeenCalled();
	});

	it.each([
		undefined,
		"",
		"   ",
		"phc_your_api_key_here",
	])("disables analytics with an absent or placeholder key (%s)", async (key) => {
		mocks.env.posthogApiKey = key;
		const { posthog } = await import("./posthog");
		expect(posthog).toBeNull();
		expect(mocks.PostHog).not.toHaveBeenCalled();
		expect(console.warn).toHaveBeenCalledOnce();
	});
});
