import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	register: vi.fn(),
	PostHog: vi.fn(),
	env: {
		apiUrl: "https://api.opnshelf.xyz",
		posthogApiKey: "test-project-key" as string | undefined,
		posthogHost: "https://eu.i.posthog.com",
	},
}));

vi.mock("posthog-react-native", () => ({ default: mocks.PostHog }));
vi.mock("./env", () => ({ env: mocks.env }));
vi.mock("expo-updates", () => ({
	updateId: "0199f40c-1111-4222-8333-444455556666",
	channel: "production",
	runtimeVersion: "1.2.0",
}));
vi.mock("expo-constants", () => ({
	default: {
		expoConfig: {
			owner: "rowanpaul",
			extra: { eas: { projectId: "87d86952-59ab-4711-9f5f-f9477b2d14f6" } },
		},
	},
}));

beforeEach(() => {
	vi.resetModules();
	mocks.register.mockClear();
	mocks.PostHog.mockReset();
	mocks.PostHog.mockImplementation(function PostHogMock() {
		return { register: mocks.register };
	});
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
		expect(mocks.register).not.toHaveBeenCalled();
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

describe("PostHog release tagging", () => {
	it("registers the EAS release as super properties on every event", async () => {
		await import("./posthog");
		expect(mocks.register).toHaveBeenCalledOnce();
		expect(mocks.register).toHaveBeenCalledWith({
			"eas/update_id": "0199f40c-1111-4222-8333-444455556666",
			"eas/channel": "production",
			"eas/runtime_version": "1.2.0",
			"eas/project_id": "87d86952-59ab-4711-9f5f-f9477b2d14f6",
			"eas/account": "rowanpaul",
		});
	});
});
