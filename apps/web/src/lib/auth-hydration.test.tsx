import { authControllerMe } from "@opnshelf/api";
import {
	dehydrate,
	hydrate,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth-context";
import { currentUserQueryOptions } from "./auth-query";

vi.mock("@opnshelf/api", () => ({
	authControllerMe: vi.fn(),
	authControllerMeOptions: () => ({ queryKey: ["auth", "me"] }),
	isUnauthorizedError: (error: { status?: number }) => error.status === 401,
	getLoginUrl: vi.fn(),
	getSignupUrl: vi.fn(),
	setOnUnauthorized: vi.fn(),
	usersControllerGetMySettingsOptions: () => ({
		queryKey: ["settings"],
		queryFn: async () => null,
	}),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("#/env", () => ({ env: { VITE_API_URL: "https://api.example.test" } }));
vi.mock("#/integrations/posthog/provider", () => ({
	posthog: { reset: vi.fn() },
}));

afterEach(cleanup);

function Home() {
	const { isAuthenticated, isLoading } = useAuth();
	if (isLoading) return <div>Checking session</div>;
	return <div>{isAuthenticated ? "Your Home" : "Public landing page"}</div>;
}

it("checks the browser session after hydrating a signed-out server render", async () => {
	const server = new QueryClient();
	const browser = new QueryClient();
	const me = vi.mocked(authControllerMe);
	try {
		// The API's host-only cookie is absent from the Web SSR request.
		me.mockRejectedValueOnce({ status: 401 });
		await server.fetchQuery(currentUserQueryOptions());
		hydrate(browser, dehydrate(server));

		expect(
			renderToString(
				<QueryClientProvider client={server}>
					<AuthProvider>
						<Home />
					</AuthProvider>
				</QueryClientProvider>,
			),
		).not.toContain("Public landing page");

		// OAuth succeeded: the browser can send that cookie directly to the API.
		me.mockResolvedValue({ data: { did: "did:plc:test" } } as Awaited<
			ReturnType<typeof authControllerMe>
		>);
		render(
			<QueryClientProvider client={browser}>
				<AuthProvider>
					<Home />
				</AuthProvider>
			</QueryClientProvider>,
		);
		expect(screen.queryByText("Public landing page")).toBeNull();
		expect(await screen.findByText("Your Home")).toBeTruthy();
		// Browser navigation still reuses the authenticated result.
		await browser.fetchQuery(currentUserQueryOptions());
		expect(me).toHaveBeenCalledTimes(2);
	} finally {
		cleanup();
		server.clear();
		browser.clear();
		me.mockReset();
	}
});

it.each([
	"signed out",
	"unavailable",
])("finishes checking when the browser session is %s", async (result) => {
	const browser = new QueryClient();
	browser.setQueryData(["auth", "me"], null);
	vi.mocked(authControllerMe).mockRejectedValue({
		status: result === "signed out" ? 401 : 503,
	});
	try {
		render(
			<QueryClientProvider client={browser}>
				<AuthProvider>
					<Home />
				</AuthProvider>
			</QueryClientProvider>,
		);
		expect(screen.queryByText("Public landing page")).toBeNull();
		expect(await screen.findByText("Public landing page")).toBeTruthy();
	} finally {
		cleanup();
		browser.clear();
		vi.mocked(authControllerMe).mockReset();
	}
});

it("keeps a cached Home visible during session refetches", async () => {
	const browser = new QueryClient();
	browser.setQueryData(["auth", "me"], {
		did: "did:plc:test",
	});
	vi.mocked(authControllerMe).mockImplementation(
		() => new Promise<never>(() => {}),
	);
	try {
		render(
			<QueryClientProvider client={browser}>
				<AuthProvider>
					<Home />
				</AuthProvider>
			</QueryClientProvider>,
		);
		expect(screen.getByText("Your Home")).toBeTruthy();
		await act(async () => {
			void browser.invalidateQueries({
				queryKey: currentUserQueryOptions().queryKey,
			});
		});
		expect(screen.getByText("Your Home")).toBeTruthy();
	} finally {
		cleanup();
		browser.clear();
		vi.mocked(authControllerMe).mockReset();
	}
});
