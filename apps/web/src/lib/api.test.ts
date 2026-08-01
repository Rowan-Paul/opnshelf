import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
	configureApiClient: vi.fn(),
	setDeviceIdentity: vi.fn(),
	setOnUnauthorized: vi.fn(),
}));

vi.mock("@opnshelf/api", () => apiMocks);
vi.mock("./device", () => ({
	browserDeviceIdentity: vi.fn(() => ({ id: "device-a", platform: "web" })),
}));
vi.mock("@tanstack/react-start", () => ({
	createIsomorphicFn: () => ({
		server: () => ({ client: (clientFn: () => unknown) => clientFn }),
	}),
}));
vi.mock("@tanstack/react-start/server", () => ({
	getRequestHeader: vi.fn(),
}));
vi.mock("#/env", () => ({
	env: { VITE_API_URL: "https://api.example.test" },
}));

describe("setupApiClient", () => {
	beforeEach(() => {
		vi.resetModules();
		apiMocks.configureApiClient.mockClear();
		apiMocks.setDeviceIdentity.mockClear();
		apiMocks.setOnUnauthorized.mockClear();
	});

	it("configures the stable API URL once without registering a callback", async () => {
		const { setupApiClient } = await import("./api");

		expect(setupApiClient()).toEqual({
			apiUrl: "https://api.example.test",
		});
		expect(setupApiClient()).toEqual({
			apiUrl: "https://api.example.test",
		});

		expect(apiMocks.configureApiClient).toHaveBeenCalledTimes(1);
		expect(apiMocks.configureApiClient).toHaveBeenCalledWith(
			"https://api.example.test",
		);
		expect(apiMocks.setOnUnauthorized).not.toHaveBeenCalled();
	});

	it("claims this browser as a device once", async () => {
		const { setupApiClient } = await import("./api");

		setupApiClient();
		setupApiClient();

		expect(apiMocks.setDeviceIdentity).toHaveBeenCalledTimes(1);
		expect(apiMocks.setDeviceIdentity).toHaveBeenCalledWith({
			id: "device-a",
			platform: "web",
		});
	});
});
