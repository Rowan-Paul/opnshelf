import type { RegisterDto, UserDto } from "@opnshelf/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactTestRenderer } from "react-test-renderer";
import { act, create } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth-context";

const mocks = vi.hoisted(() => ({
	authControllerLogout: vi.fn(),
	authControllerMe: vi.fn(),
	authControllerRegister: vi.fn(),
	getSessionToken: vi.fn(),
	loadSessionToken: vi.fn(),
	posthogCapture: vi.fn(),
	posthogIdentify: vi.fn(),
	posthogReset: vi.fn(),
	routerReplace: vi.fn(),
	saveSessionToken: vi.fn(),
	setOnUnauthorized: vi.fn(),
}));

vi.mock("@opnshelf/api", () => ({
	authControllerLogout: mocks.authControllerLogout,
	authControllerMe: mocks.authControllerMe,
	authControllerMeQueryKey: () => ["auth", "me"],
	authControllerRegister: mocks.authControllerRegister,
	getLoginUrl: vi.fn(),
	getSessionToken: mocks.getSessionToken,
	setOnUnauthorized: mocks.setOnUnauthorized,
}));

vi.mock("expo-router", () => ({
	router: { replace: mocks.routerReplace },
}));

vi.mock("expo-web-browser", () => ({
	openAuthSessionAsync: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
	loadSessionToken: mocks.loadSessionToken,
	saveSessionToken: mocks.saveSessionToken,
}));

vi.mock("@/lib/posthog", () => ({
	posthog: {
		capture: mocks.posthogCapture,
		identify: mocks.posthogIdentify,
		reset: mocks.posthogReset,
	},
}));

const testUser = {
	did: "did:example:test-user",
} as UserDto;

const nextUser = {
	did: "did:example:next-user",
} as UserDto;

function AuthProbe({
	onRender,
}: {
	onRender: (auth: ReturnType<typeof useAuth>) => void;
}) {
	const auth = useAuth();
	onRender(auth);
	return null;
}

function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});
}

async function renderAuth(queryClient = createQueryClient()) {
	let currentAuth: ReturnType<typeof useAuth> | undefined;
	let renderer: ReactTestRenderer;

	await act(async () => {
		renderer = create(
			<QueryClientProvider client={queryClient}>
				<AuthProvider>
					<AuthProbe onRender={(auth) => (currentAuth = auth)} />
				</AuthProvider>
			</QueryClientProvider>,
		);
	});

	return {
		get auth() {
			if (!currentAuth) throw new Error("AuthProvider did not render");
			return currentAuth;
		},
		queryClient,
		unmount: () => act(() => renderer.unmount()),
	};
}

function seedIdentityCaches(queryClient: QueryClient) {
	queryClient.setQueryData(["account-a", "shelf"], { id: "private-a" });
	queryClient.setQueryData(["public", "trending"], { id: "public" });
	queryClient.getMutationCache().build(queryClient, {
		mutationKey: ["account-a", "update-shelf"],
		mutationFn: async () => undefined,
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.authControllerLogout.mockResolvedValue({ data: {} });
	mocks.getSessionToken.mockReturnValue(null);
	mocks.loadSessionToken.mockResolvedValue(null);
	mocks.saveSessionToken.mockResolvedValue(undefined);
	mocks.authControllerMe.mockResolvedValue({ data: nextUser });
});

describe("AuthProvider", () => {
	it("settles signed out without requesting me when session restoration fails", async () => {
		mocks.loadSessionToken.mockRejectedValue(new Error("test restore failure"));
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		const harness = await renderAuth();

		expect(harness.auth.isLoading).toBe(false);
		expect(harness.auth.isAuthenticated).toBe(false);
		expect(mocks.authControllerMe).not.toHaveBeenCalled();
		expect(consoleError).toHaveBeenCalledWith(
			"Failed to restore the persisted session",
		);
		expect(consoleError.mock.calls[0]).toHaveLength(1);

		harness.unmount();
	});

	it("does not clear auth state or navigate when sign-out storage deletion fails", async () => {
		mocks.loadSessionToken.mockResolvedValue("test-session");
		mocks.getSessionToken.mockReturnValue("test-session");
		mocks.saveSessionToken.mockRejectedValue(new Error("test delete failure"));
		mocks.authControllerMe.mockResolvedValue({ data: testUser });
		const harness = await renderAuth();
		await act(async () => {
			await vi.waitFor(() => expect(harness.auth.isAuthenticated).toBe(true));
		});
		const cancelQueries = vi.spyOn(harness.queryClient, "cancelQueries");
		const clear = vi.spyOn(harness.queryClient, "clear");

		await expect(harness.auth.signOut()).rejects.toThrow("test delete failure");
		expect(harness.auth.isAuthenticated).toBe(true);
		expect(mocks.posthogReset).not.toHaveBeenCalled();
		expect(cancelQueries).not.toHaveBeenCalled();
		expect(clear).not.toHaveBeenCalled();
		expect(mocks.routerReplace).not.toHaveBeenCalled();

		harness.unmount();
	});

	it("cancels work and clears every cache before explicit sign-out navigation", async () => {
		const harness = await renderAuth();
		seedIdentityCaches(harness.queryClient);
		let wasAborted = false;
		const inFlight = harness.queryClient
			.fetchQuery({
				queryKey: ["account-a", "in-flight"],
				queryFn: ({ signal }) =>
					new Promise<never>((_resolve, reject) => {
						signal.addEventListener("abort", () => {
							wasAborted = true;
							reject(new Error("aborted"));
						});
					}),
			})
			.catch(() => undefined);
		const cancelQueries = vi.spyOn(harness.queryClient, "cancelQueries");
		const clear = vi.spyOn(harness.queryClient, "clear");

		await act(async () => harness.auth.signOut());
		await inFlight;

		expect(wasAborted).toBe(true);
		expect(cancelQueries).toHaveBeenCalledOnce();
		expect(clear).toHaveBeenCalledOnce();
		expect(cancelQueries.mock.invocationCallOrder[0]).toBeLessThan(
			clear.mock.invocationCallOrder[0],
		);
		expect(clear.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.routerReplace.mock.invocationCallOrder[0],
		);
		expect(
			harness.queryClient.getQueryData(["account-a", "shelf"]),
		).toBeUndefined();
		expect(
			harness.queryClient.getQueryData(["public", "trending"]),
		).toBeUndefined();
		expect(
			harness.queryClient.getQueryData(["account-a", "in-flight"]),
		).toBeUndefined();
		expect(harness.queryClient.getMutationCache().getAll()).toHaveLength(0);

		harness.unmount();
	});

	it("clears an expired identity once before navigating on concurrent 401s", async () => {
		mocks.loadSessionToken.mockResolvedValue("expired-session");
		mocks.getSessionToken.mockReturnValue("expired-session");
		mocks.authControllerMe.mockResolvedValue({ data: testUser });
		const harness = await renderAuth();
		seedIdentityCaches(harness.queryClient);
		const cancelQueries = vi.spyOn(harness.queryClient, "cancelQueries");
		const clear = vi.spyOn(harness.queryClient, "clear");
		const unauthorized = mocks.setOnUnauthorized.mock.calls.at(-1)?.[0];

		expect(unauthorized).toBeTypeOf("function");
		await act(async () => {
			unauthorized();
			unauthorized();
			await vi.waitFor(() =>
				expect(mocks.routerReplace).toHaveBeenCalledOnce(),
			);
		});

		expect(mocks.saveSessionToken).toHaveBeenCalledTimes(1);
		expect(cancelQueries).toHaveBeenCalledOnce();
		expect(clear).toHaveBeenCalledOnce();
		expect(clear.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.routerReplace.mock.invocationCallOrder[0],
		);
		expect(mocks.routerReplace).toHaveBeenCalledWith({
			pathname: "/login",
			params: { reason: "session_expired" },
		});
		expect(
			harness.queryClient.getQueryData(["account-a", "shelf"]),
		).toBeUndefined();
		expect(
			harness.queryClient.getQueryData(["public", "trending"]),
		).toBeUndefined();
		expect(harness.queryClient.getMutationCache().getAll()).toHaveLength(0);

		harness.unmount();
	});

	it("clears account A before completing account B and keeps B's me data", async () => {
		const harness = await renderAuth();
		seedIdentityCaches(harness.queryClient);
		mocks.authControllerMe.mockImplementation(async () => {
			expect(harness.queryClient.getQueryData(["account-a", "shelf"])).toBe(
				undefined,
			);
			expect(harness.queryClient.getMutationCache().getAll()).toHaveLength(0);
			return { data: nextUser };
		});

		await act(async () => {
			await harness.auth.completeSession("account-b-session");
		});

		expect(mocks.saveSessionToken).toHaveBeenCalledWith("account-b-session");
		expect(harness.queryClient.getQueryData(["auth", "me"])).toEqual(nextUser);
		expect(mocks.posthogIdentify).toHaveBeenCalledWith(nextUser.did, {
			$set_once: { first_login_date: expect.any(String) },
		});

		harness.unmount();
	});

	it("clears account A before installing a registered account B", async () => {
		const harness = await renderAuth();
		seedIdentityCaches(harness.queryClient);
		mocks.authControllerRegister.mockResolvedValue({
			data: { sessionId: "registered-b-session" },
		});
		mocks.authControllerMe.mockImplementation(async () => {
			expect(harness.queryClient.getQueryData(["account-a", "shelf"])).toBe(
				undefined,
			);
			expect(harness.queryClient.getMutationCache().getAll()).toHaveLength(0);
			return { data: nextUser };
		});

		await act(async () => {
			await harness.auth.register({} as RegisterDto);
		});

		expect(mocks.saveSessionToken).toHaveBeenCalledWith("registered-b-session");
		expect(harness.queryClient.getQueryData(["auth", "me"])).toEqual(nextUser);
		expect(mocks.posthogCapture).toHaveBeenCalledWith("user_signed_up", {
			method: "pds_register",
		});

		harness.unmount();
	});

	it("revokes the server session before clearing local state", async () => {
		mocks.loadSessionToken.mockResolvedValue("test-session");
		mocks.getSessionToken.mockReturnValue("test-session");
		mocks.authControllerMe.mockResolvedValue({ data: testUser });
		const harness = await renderAuth();
		await act(async () => {
			await vi.waitFor(() => expect(harness.auth.isAuthenticated).toBe(true));
		});
		const clear = vi.spyOn(harness.queryClient, "clear");

		await act(async () => harness.auth.signOut());

		expect(mocks.authControllerLogout).toHaveBeenCalledWith({
			throwOnError: true,
		});
		expect(mocks.authControllerLogout.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.saveSessionToken.mock.invocationCallOrder[0],
		);
		expect(mocks.saveSessionToken).toHaveBeenCalledWith(null);
		expect(mocks.posthogReset).toHaveBeenCalledOnce();
		expect(clear).toHaveBeenCalledOnce();
		expect(mocks.routerReplace).toHaveBeenCalledWith("/login");

		harness.unmount();
	});

	it("clears local state when the server reports an already-invalid session", async () => {
		mocks.loadSessionToken.mockResolvedValue("test-session");
		mocks.getSessionToken.mockReturnValue("test-session");
		mocks.authControllerLogout.mockRejectedValue({
			statusCode: 401,
			message: "Unauthorized",
		});
		const harness = await renderAuth();
		const clear = vi.spyOn(harness.queryClient, "clear");

		await act(async () => harness.auth.signOut());

		expect(mocks.saveSessionToken).toHaveBeenCalledWith(null);
		expect(clear).toHaveBeenCalledOnce();
		expect(mocks.routerReplace).toHaveBeenCalledWith("/login");

		harness.unmount();
	});

	it.each([
		new TypeError("network unavailable"),
		{ statusCode: 503, message: "Unavailable" },
	])("clears local state even when server logout fails (%o)", async (logoutError) => {
		mocks.loadSessionToken.mockResolvedValue("test-session");
		mocks.getSessionToken.mockReturnValue("test-session");
		mocks.authControllerLogout.mockRejectedValue(logoutError);
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		const harness = await renderAuth();
		const clear = vi.spyOn(harness.queryClient, "clear");

		// Best-effort revocation: an offline user must still be able to sign out
		// locally; the server session expires by TTL.
		await act(async () => harness.auth.signOut());

		expect(consoleError).toHaveBeenCalledWith(
			"Failed to revoke the server session",
			logoutError,
		);
		expect(mocks.saveSessionToken).toHaveBeenCalledWith(null);
		expect(mocks.posthogReset).toHaveBeenCalledOnce();
		expect(clear).toHaveBeenCalledOnce();
		expect(mocks.routerReplace).toHaveBeenCalledWith("/login");

		harness.unmount();
	});
});
