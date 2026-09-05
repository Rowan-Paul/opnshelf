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
	beginHandoff: vi.fn(),
	clearHandoff: vi.fn(),
	getLoginUrl: vi.fn(),
	getSessionToken: vi.fn(),
	loadSessionToken: vi.fn(),
	openAuthSessionAsync: vi.fn(),
	redeemHandoffCode: vi.fn(),
	posthogCapture: vi.fn(),
	posthogIdentify: vi.fn(),
	posthogReset: vi.fn(),
	routerReplace: vi.fn(),
	saveSessionToken: vi.fn(),
	setOnUnauthorized: vi.fn(),
	setWidgetHandle: vi.fn(),
}));

vi.mock("@opnshelf/api", () => ({
	authControllerLogout: mocks.authControllerLogout,
	authControllerMe: mocks.authControllerMe,
	authControllerMeQueryKey: () => ["auth", "me"],
	authControllerRegister: mocks.authControllerRegister,
	getLoginUrl: mocks.getLoginUrl,
	getSessionToken: mocks.getSessionToken,
	setOnUnauthorized: mocks.setOnUnauthorized,
}));

vi.mock("expo-router", () => ({
	router: { replace: mocks.routerReplace },
}));

vi.mock("expo-web-browser", () => ({
	openAuthSessionAsync: mocks.openAuthSessionAsync,
}));

vi.mock("@/lib/auth-handoff", () => ({
	beginHandoff: mocks.beginHandoff,
	clearHandoff: mocks.clearHandoff,
	redeemHandoffCode: mocks.redeemHandoffCode,
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

vi.mock("../../modules/widget-bridge", () => ({
	setWidgetHandle: mocks.setWidgetHandle,
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
	mocks.beginHandoff.mockResolvedValue(null);
	mocks.clearHandoff.mockResolvedValue(undefined);
	mocks.getLoginUrl.mockReturnValue("https://api.test.invalid/auth/login");
	mocks.openAuthSessionAsync.mockResolvedValue({ type: "cancel" });
});

describe("mobile handoff code", () => {
	it("starts login with the backend-issued challenge in the URL", async () => {
		mocks.beginHandoff.mockResolvedValue("challenge");
		const harness = await renderAuth();

		await act(async () => {
			await harness.auth.login(" alice.test ");
		});

		expect(mocks.getLoginUrl).toHaveBeenCalledWith(
			"alice.test",
			expect.anything(),
			"mobile",
			"challenge",
		);
		expect(mocks.openAuthSessionAsync).toHaveBeenCalledWith(
			"https://api.test.invalid/auth/login",
			"opnshelf://auth/complete",
		);

		harness.unmount();
	});

	it("starts login without a challenge when the backend cannot issue one", async () => {
		const harness = await renderAuth();

		await act(async () => {
			await harness.auth.login("alice.test");
		});

		expect(mocks.getLoginUrl).toHaveBeenCalledWith(
			"alice.test",
			expect.anything(),
			"mobile",
			undefined,
		);

		harness.unmount();
	});

	it("redeems a code from the redirect before installing the session", async () => {
		mocks.openAuthSessionAsync.mockResolvedValue({
			type: "success",
			url: "opnshelf://auth/complete?code=handoff-code",
		});
		mocks.redeemHandoffCode.mockResolvedValue("exchanged-session");
		const harness = await renderAuth();

		let completed: boolean | undefined;
		await act(async () => {
			completed = await harness.auth.runAuthorizationUrl(
				"https://pds.test/authorize",
			);
		});

		expect(completed).toBe(true);
		expect(mocks.redeemHandoffCode).toHaveBeenCalledWith("handoff-code");
		expect(mocks.saveSessionToken).toHaveBeenCalledWith("exchanged-session");
		expect(harness.queryClient.getQueryData(["auth", "me"])).toEqual(nextUser);

		harness.unmount();
	});

	it("still accepts the legacy session redirect and drops any pending verifier", async () => {
		mocks.openAuthSessionAsync.mockResolvedValue({
			type: "success",
			url: "opnshelf://auth/complete?session=legacy-session",
		});
		const harness = await renderAuth();

		await act(async () => {
			await harness.auth.runAuthorizationUrl("https://pds.test/authorize");
		});

		expect(mocks.redeemHandoffCode).not.toHaveBeenCalled();
		expect(mocks.clearHandoff).toHaveBeenCalled();
		expect(mocks.saveSessionToken).toHaveBeenCalledWith("legacy-session");

		harness.unmount();
	});

	it("drops the pending verifier when the browser flow is cancelled or fails", async () => {
		const harness = await renderAuth();

		await act(async () => {
			await expect(
				harness.auth.runAuthorizationUrl("https://pds.test/authorize"),
			).resolves.toBe(false);
		});
		expect(mocks.clearHandoff).toHaveBeenCalledTimes(1);

		mocks.openAuthSessionAsync.mockResolvedValue({
			type: "success",
			url: "opnshelf://auth/complete?error=callback_failed",
		});
		await act(async () => {
			await expect(
				harness.auth.runAuthorizationUrl("https://pds.test/authorize"),
			).rejects.toThrow("Auth flow failed: callback_failed");
		});
		expect(mocks.clearHandoff).toHaveBeenCalledTimes(2);
		expect(mocks.saveSessionToken).not.toHaveBeenCalled();

		harness.unmount();
	});

	it("completes a deep-linked handoff code through completeHandoff", async () => {
		mocks.redeemHandoffCode.mockResolvedValue("deep-linked-session");
		const harness = await renderAuth();

		await act(async () => {
			await harness.auth.completeHandoff("handoff-code");
		});

		expect(mocks.redeemHandoffCode).toHaveBeenCalledWith("handoff-code");
		expect(mocks.saveSessionToken).toHaveBeenCalledWith("deep-linked-session");

		harness.unmount();
	});
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
