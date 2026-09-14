import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ init: vi.fn() }));
vi.mock("posthog-js", () => ({
	default: { init: mocks.init, startExceptionAutocapture: vi.fn() },
}));
vi.mock("@posthog/react", () => ({ PostHogProvider: vi.fn() }));

beforeEach(() => {
	vi.resetModules();
	mocks.init.mockClear();
	vi.stubGlobal("window", { location: { hostname: "opnshelf.xyz" } });
	vi.stubEnv("VITE_POSTHOG_KEY", "test-project-key");
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe("PostHog exception titles", () => {
	it("uses the captured message as the issue title without changing grouping or URL redaction", async () => {
		await import("./provider");
		const beforeSend = mocks.init.mock.calls[0][1].before_send;
		const exception = {
			type: "Error",
			value: "ThrottlerException: Too Many Requests",
		};
		const event = beforeSend({
			event: "$exception",
			properties: {
				$exception_list: [exception],
				$exception_fingerprint: "existing-fingerprint",
				$current_url: "https://opnshelf.xyz/private",
				$pathname: "/private",
				$referrer: "https://example.com/private",
			},
		});
		expect(event.properties).toEqual({
			$exception_list: [exception],
			$exception_fingerprint: "existing-fingerprint",
			$issue_name: "ThrottlerException: Too Many Requests",
		});
	});

	it.each([
		undefined,
		null,
		[],
		[{}],
		[{ value: 123 }],
		[{ value: "  " }],
	])("leaves the default title for a missing or malformed message (%j)", async (exceptions) => {
		await import("./provider");
		const beforeSend = mocks.init.mock.calls[0][1].before_send;
		const event = {
			event: "$exception",
			properties: { $exception_list: exceptions },
		};
		expect(beforeSend(event).properties).not.toHaveProperty("$issue_name");
	});

	it("preserves explicit titles, ordinary events and dropped events", async () => {
		await import("./provider");
		const beforeSend = mocks.init.mock.calls[0][1].before_send;
		const properties = {
			$issue_name: "Custom title",
			$exception_list: [{ value: "Message" }],
		};
		expect(
			beforeSend({ event: "$exception", properties }).properties.$issue_name,
		).toBe("Custom title");
		const ordinary = { event: "watch_logged", properties: {} };
		expect(beforeSend(ordinary)).toEqual(ordinary);
		expect(beforeSend(null)).toBeNull();
	});

	it("trims and limits titles to PostHog's 255 characters", async () => {
		await import("./provider");
		const beforeSend = mocks.init.mock.calls[0][1].before_send;
		const event = beforeSend({
			event: "$exception",
			properties: { $exception_list: [{ value: `  ${"x".repeat(300)}  ` }] },
		});
		expect(event.properties.$issue_name).toBe("x".repeat(255));
	});

	it("keeps the title valid Unicode when the limit falls inside a character", async () => {
		await import("./provider");
		const beforeSend = mocks.init.mock.calls[0][1].before_send;
		const event = beforeSend({
			event: "$exception",
			properties: {
				$exception_list: [{ value: `${"x".repeat(254)}\u{1f600}x` }],
			},
		});
		expect(event.properties.$issue_name).toBe("x".repeat(254));
	});
});
