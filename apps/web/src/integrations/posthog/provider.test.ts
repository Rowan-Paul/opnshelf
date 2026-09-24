import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn() }));
vi.mock("posthog-js", () => ({
	default: {
		init: mocks.init,
		capture: mocks.capture,
		startExceptionAutocapture: vi.fn(),
	},
}));

beforeEach(() => {
	vi.resetModules();
	mocks.init.mockClear();
	mocks.capture.mockClear();
	vi.stubGlobal("window", { location: { hostname: "opnshelf.xyz" } });
	vi.stubEnv("VITE_POSTHOG_KEY", "test-project-key");
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe("PostHog lazy loading", () => {
	it("replays calls made before posthog-js loads, after it is initialised", async () => {
		const { posthog, posthogLoaded } = await import("./provider");
		posthog.capture("watch_logged", { media_type: "movie" });
		expect(mocks.capture).not.toHaveBeenCalled();

		await posthogLoaded;
		expect(mocks.init).toHaveBeenCalledBefore(mocks.capture);
		expect(mocks.capture).toHaveBeenCalledWith("watch_logged", {
			media_type: "movie",
		});
	});

	it("drops calls off the production origin without loading posthog-js", async () => {
		vi.stubGlobal("window", { location: { hostname: "localhost" } });
		const { posthog, posthogLoaded } = await import("./provider");
		posthog.capture("watch_logged");
		expect(posthogLoaded).toBeUndefined();
		expect(mocks.capture).not.toHaveBeenCalled();
	});
});

describe("PostHog exception titles", () => {
	it("keeps categorical pageview location while redacting other event URLs", async () => {
		await (await import("./provider")).posthogLoaded;
		const beforeSend = mocks.init.mock.calls[0][1].before_send;
		const pageview = beforeSend({
			event: "$pageview",
			properties: {
				$current_url: "https://opnshelf.xyz",
				$pathname: "/discover",
				$referrer: "https://example.com/private",
			},
		});
		expect(pageview.properties).toEqual({
			$current_url: "https://opnshelf.xyz",
			$pathname: "/discover",
		});
	});

	it("uses the captured message as the issue title without changing grouping or URL redaction", async () => {
		await (await import("./provider")).posthogLoaded;
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
		await (await import("./provider")).posthogLoaded;
		const beforeSend = mocks.init.mock.calls[0][1].before_send;
		const event = {
			event: "$exception",
			properties: { $exception_list: exceptions },
		};
		expect(beforeSend(event).properties).not.toHaveProperty("$issue_name");
	});

	it("preserves explicit titles, ordinary events and dropped events", async () => {
		await (await import("./provider")).posthogLoaded;
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
		await (await import("./provider")).posthogLoaded;
		const beforeSend = mocks.init.mock.calls[0][1].before_send;
		const event = beforeSend({
			event: "$exception",
			properties: { $exception_list: [{ value: `  ${"x".repeat(300)}  ` }] },
		});
		expect(event.properties.$issue_name).toBe("x".repeat(255));
	});

	it("keeps the title valid Unicode when the limit falls inside a character", async () => {
		await (await import("./provider")).posthogLoaded;
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
