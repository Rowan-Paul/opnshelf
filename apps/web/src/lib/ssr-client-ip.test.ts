// @vitest-environment node
import { createHmac } from "node:crypto";
import { getRequestHeader } from "@tanstack/react-start/server";
import { afterEach, expect, it, vi } from "vitest";
import { signSsrClientIp } from "./ssr-client-ip.server";

vi.mock("@tanstack/react-start", () => ({
	createIsomorphicFn: () => ({
		server: (serverFn: unknown) => ({ client: () => serverFn }),
	}),
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: vi.fn() }));
vi.mock("#/env", () => ({
	env: {
		VITE_API_URL: "https://api.example.test",
		get SSR_RATE_LIMIT_SECRET() {
			return process.env.SSR_RATE_LIMIT_SECRET;
		},
	},
}));
const secret = "test-only-ssr-forwarding-key-at-least-32-characters";
afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

it("signs public loader requests through the shared client, without leaking identities between renders", async () => {
	vi.stubEnv("SSR_RATE_LIMIT_SECRET", secret);
	const { setupApiClient } = await import("./api");
	const { showsControllerGetShowDetails } = await import("@opnshelf/api");
	setupApiClient();
	vi.mocked(getRequestHeader)
		.mockReturnValueOnce("198.51.100.1")
		.mockReturnValueOnce("198.51.100.2");
	const requests: Request[] = [];
	vi.stubGlobal("fetch", async (request: Request) => {
		requests.push(request);
		return Response.json({ id: 615 });
	});
	await Promise.all([
		showsControllerGetShowDetails({ path: { showId: "615" } }),
		showsControllerGetShowDetails({ path: { showId: "466" } }),
	]);
	expect(
		requests.map((r) => r.headers.get("x-opnshelf-client-ip")).sort(),
	).toEqual(["198.51.100.1", "198.51.100.2"]);
	for (const request of requests) {
		const ip = request.headers.get("x-opnshelf-client-ip");
		const timestamp = request.headers.get("x-opnshelf-client-time");
		expect(request.headers.get("x-opnshelf-client-signature")).toBe(
			createHmac("sha256", secret).update(`${ip}\n${timestamp}`).digest("hex"),
		);
	}
	// A caller overriding the API destination must never get a signed identity.
	await showsControllerGetShowDetails({
		baseUrl: "https://other.example.test",
		path: { showId: "615" },
	});
	expect(requests[2].headers.has("x-opnshelf-client-signature")).toBe(false);
});

it("does not sign absent or malformed IPs, or operate without a configured key", () => {
	vi.stubEnv("SSR_RATE_LIMIT_SECRET", secret);
	for (const ip of [undefined, "", "198.51.100.1, 203.0.113.1", "not-an-ip"]) {
		expect(
			signSsrClientIp(new Request("https://api.example.test"), ip).headers.has(
				"x-opnshelf-client-signature",
			),
		).toBe(false);
	}
	vi.stubEnv("SSR_RATE_LIMIT_SECRET", "");
	expect(
		signSsrClientIp(
			new Request("https://api.example.test"),
			"198.51.100.1",
		).headers.has("x-opnshelf-client-signature"),
	).toBe(false);
});
