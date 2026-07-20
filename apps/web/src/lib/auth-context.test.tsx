import { cleanup, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./auth-context";

const mocks = vi.hoisted(() => ({
	authQueryKey: ["auth", "me"] as const,
	currentQueryClient: {
		setQueryData: vi.fn(),
		clear: vi.fn(),
	},
	setOnUnauthorized: vi.fn(),
	useQuery: vi.fn(),
}));

vi.mock("@opnshelf/api", () => ({
	authControllerMe: vi.fn(),
	authControllerMeOptions: () => ({ queryKey: mocks.authQueryKey }),
	getLoginUrl: vi.fn(() => "https://api.example.test/auth/login"),
	getSignupUrl: vi.fn(() => "https://api.example.test/auth/signup"),
	setOnUnauthorized: mocks.setOnUnauthorized,
	usersControllerGetMySettingsOptions: () => ({
		queryKey: ["user", "settings"],
	}),
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: (options: unknown) => mocks.useQuery(options),
	useQueryClient: () => mocks.currentQueryClient,
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => vi.fn(),
}));

vi.mock("#/env", () => ({
	env: { VITE_API_URL: "https://api.example.test" },
}));

vi.mock("#/integrations/posthog/provider", () => ({
	posthog: { reset: vi.fn() },
}));

function client(name: string) {
	return {
		name,
		setQueryData: vi.fn(),
		clear: vi.fn(),
	};
}

describe("AuthProvider unauthorized lifecycle", () => {
	beforeEach(() => {
		mocks.setOnUnauthorized.mockClear();
		mocks.useQuery.mockReset();
		mocks.useQuery.mockReturnValue({ data: null, isLoading: false });
		mocks.currentQueryClient = client("default");
	});

	afterEach(() => cleanup());

	it("does not register or capture a QueryClient during independent SSR renders", () => {
		const firstClient = client("first");
		mocks.currentQueryClient = firstClient;
		renderToString(
			<AuthProvider>
				<div>first</div>
			</AuthProvider>,
		);

		const secondClient = client("second");
		mocks.currentQueryClient = secondClient;
		renderToString(
			<AuthProvider>
				<div>second</div>
			</AuthProvider>,
		);

		expect(mocks.setOnUnauthorized).not.toHaveBeenCalled();
		expect(firstClient.setQueryData).not.toHaveBeenCalled();
		expect(secondClient.setQueryData).not.toHaveBeenCalled();
	});

	it("registers after browser mount, clears auth data, and cleans up", () => {
		const queryClient = client("browser");
		mocks.currentQueryClient = queryClient;

		const view = render(
			<AuthProvider>
				<div>browser</div>
			</AuthProvider>,
		);

		expect(mocks.setOnUnauthorized).toHaveBeenCalledTimes(1);
		const callback = mocks.setOnUnauthorized.mock.calls[0]?.[0];
		expect(callback).toBeTypeOf("function");
		callback?.();
		expect(queryClient.setQueryData).toHaveBeenCalledWith(
			mocks.authQueryKey,
			undefined,
		);

		view.rerender(
			<AuthProvider>
				<div>rerendered</div>
			</AuthProvider>,
		);
		expect(mocks.setOnUnauthorized).toHaveBeenCalledTimes(1);

		view.unmount();
		expect(mocks.setOnUnauthorized).toHaveBeenLastCalledWith(null);
	});
});
