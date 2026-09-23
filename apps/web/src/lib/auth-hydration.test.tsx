import { authControllerMe } from "@opnshelf/api";
import {
	dehydrate,
	hydrate,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth-context";
import {
	currentUserQueryOptions,
	SESSION_CHECK_DEADLINE_MS,
} from "./auth-query";

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
const hint = vi.hoisted(() => ({ present: true, remember: vi.fn() }));
vi.mock("./session-hint", () => ({
	SIGNED_IN_HINT_QUERY_KEY: ["session-hint"],
	mayBeSignedIn: () => hint.present,
	rememberSignedIn: hint.remember,
}));

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	hint.present = true;
	hint.remember.mockClear();
});

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
		// Only a real "signed out" answer clears the signed-in hint; an outage
		// says nothing about the session.
		if (result === "signed out") {
			await vi.waitFor(() => expect(hint.remember).toHaveBeenCalledWith(false));
		} else {
			expect(hint.remember).not.toHaveBeenCalled();
		}
	} finally {
		cleanup();
		browser.clear();
		vi.mocked(authControllerMe).mockReset();
	}
});

it("finishes checking when the browser session request never answers", async () => {
	vi.useFakeTimers({ shouldAdvanceTime: true });
	const browser = new QueryClient();
	browser.setQueryData(["auth", "me"], null);
	vi.mocked(authControllerMe).mockImplementation(
		(options) =>
			new Promise<never>((_, reject) => {
				options?.signal?.addEventListener("abort", () =>
					reject(options.signal?.reason),
				);
			}),
	);
	try {
		render(
			<QueryClientProvider client={browser}>
				<AuthProvider>
					<Home />
				</AuthProvider>
			</QueryClientProvider>,
		);
		expect(screen.getByText("Checking session")).toBeTruthy();
		await act(async () => {
			vi.advanceTimersByTime(SESSION_CHECK_DEADLINE_MS);
		});
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

describe("without a signed-in hint", () => {
	it("renders public content from SSR and keeps it through hydration", async () => {
		hint.present = false;
		const server = new QueryClient();
		const browser = new QueryClient();
		server.setQueryData(["auth", "me"], null);
		hydrate(browser, dehydrate(server));
		vi.mocked(authControllerMe).mockRejectedValue({ status: 401 });
		try {
			expect(
				renderToString(
					<QueryClientProvider client={server}>
						<AuthProvider>
							<Home />
						</AuthProvider>
					</QueryClientProvider>,
				),
			).toContain("Public landing page");

			render(
				<QueryClientProvider client={browser}>
					<AuthProvider>
						<Home />
					</AuthProvider>
				</QueryClientProvider>,
			);
			expect(screen.getByText("Public landing page")).toBeTruthy();
			await vi.waitFor(() => expect(hint.remember).toHaveBeenCalledWith(false));
		} finally {
			server.clear();
			browser.clear();
			vi.mocked(authControllerMe).mockReset();
		}
	});

	it("switches to Home and remembers the session when the browser is signed in", async () => {
		hint.present = false;
		const browser = new QueryClient();
		browser.setQueryData(["auth", "me"], null);
		vi.mocked(authControllerMe).mockResolvedValue({
			data: { did: "did:plc:test" },
		} as Awaited<ReturnType<typeof authControllerMe>>);
		try {
			render(
				<QueryClientProvider client={browser}>
					<AuthProvider>
						<Home />
					</AuthProvider>
				</QueryClientProvider>,
			);
			expect(await screen.findByText("Your Home")).toBeTruthy();
			expect(hint.remember).toHaveBeenCalledWith(true);
		} finally {
			browser.clear();
			vi.mocked(authControllerMe).mockReset();
		}
	});

	it("hydrates with SSR's decision when the browser cannot see the same cookies", () => {
		// The server saw an HttpOnly session cookie that document.cookie hides.
		hint.present = false;
		const browser = new QueryClient();
		browser.setQueryData(["auth", "me"], null);
		browser.setQueryData(["session-hint"], true);
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
			expect(screen.getByText("Checking session")).toBeTruthy();
		} finally {
			browser.clear();
			vi.mocked(authControllerMe).mockReset();
		}
	});
});
