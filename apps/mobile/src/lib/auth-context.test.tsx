import type { UserDto } from "@opnshelf/api";
import type { ReactTestRenderer } from "react-test-renderer";
import { act, create } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth-context";

const mocks = vi.hoisted(() => ({
	authControllerLogout: vi.fn(),
	authControllerMe: vi.fn(),
	loadSessionToken: vi.fn(),
	posthogReset: vi.fn(),
	queryClient: {
		clear: vi.fn(),
		fetchQuery: vi.fn(),
		removeQueries: vi.fn(),
		setQueryData: vi.fn(),
	},
	routerReplace: vi.fn(),
	saveSessionToken: vi.fn(),
	setOnUnauthorized: vi.fn(),
	useQuery: vi.fn(),
}));

vi.mock("@opnshelf/api", () => ({
	authControllerLogout: mocks.authControllerLogout,
	authControllerMe: mocks.authControllerMe,
	authControllerMeQueryKey: () => ["auth", "me"],
	authControllerRegister: vi.fn(),
	getLoginUrl: vi.fn(),
	getSessionToken: vi.fn(() => null),
	setOnUnauthorized: mocks.setOnUnauthorized,
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: mocks.useQuery,
	useQueryClient: () => mocks.queryClient,
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
	posthog: { reset: mocks.posthogReset },
}));

const testUser = {
	did: "did:example:test-user",
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

beforeEach(() => {
	vi.clearAllMocks();
	mocks.authControllerLogout.mockResolvedValue({ data: {} });
	mocks.loadSessionToken.mockResolvedValue(null);
	mocks.saveSessionToken.mockResolvedValue(undefined);
	mocks.useQuery.mockReturnValue({ data: null, isPending: false });
});

describe("AuthProvider", () => {
	it("settles signed out without requesting me when session restoration fails", async () => {
		const storageError = new Error("test restore failure");
		mocks.loadSessionToken.mockRejectedValue(storageError);
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		let currentAuth: ReturnType<typeof useAuth> | undefined;
		let renderer: ReactTestRenderer;

		await act(async () => {
			renderer = create(
				<AuthProvider>
					<AuthProbe onRender={(auth) => (currentAuth = auth)} />
				</AuthProvider>,
			);
		});

		expect(currentAuth?.isLoading).toBe(false);
		expect(currentAuth?.isAuthenticated).toBe(false);
		expect(mocks.authControllerMe).not.toHaveBeenCalled();
		expect(mocks.useQuery.mock.calls.at(-1)?.[0]).toMatchObject({
			enabled: false,
		});
		expect(consoleError).toHaveBeenCalledWith(
			"Failed to restore the persisted session",
		);
		expect(consoleError.mock.calls[0]).toHaveLength(1);

		act(() => renderer.unmount());
	});

	it("does not clear auth state or navigate when sign-out storage deletion fails", async () => {
		mocks.loadSessionToken.mockResolvedValue("test-session");
		mocks.saveSessionToken.mockRejectedValue(new Error("test delete failure"));
		mocks.useQuery.mockReturnValue({ data: testUser, isPending: false });
		let currentAuth: ReturnType<typeof useAuth> | undefined;
		let renderer: ReactTestRenderer;

		await act(async () => {
			renderer = create(
				<AuthProvider>
					<AuthProbe onRender={(auth) => (currentAuth = auth)} />
				</AuthProvider>,
			);
		});

		await expect(currentAuth?.signOut()).rejects.toThrow("test delete failure");
		expect(currentAuth?.isAuthenticated).toBe(true);
		expect(mocks.posthogReset).not.toHaveBeenCalled();
		expect(mocks.queryClient.setQueryData).not.toHaveBeenCalled();
		expect(mocks.queryClient.clear).not.toHaveBeenCalled();
		expect(mocks.routerReplace).not.toHaveBeenCalled();

		act(() => renderer.unmount());
	});

	it("revokes the server session before clearing local state", async () => {
		mocks.loadSessionToken.mockResolvedValue("test-session");
		mocks.useQuery.mockReturnValue({ data: testUser, isPending: false });
		let currentAuth: ReturnType<typeof useAuth> | undefined;
		let renderer: ReactTestRenderer;

		await act(async () => {
			renderer = create(
				<AuthProvider>
					<AuthProbe onRender={(auth) => (currentAuth = auth)} />
				</AuthProvider>,
			);
		});

		await act(async () => {
			await currentAuth?.signOut();
		});

		expect(mocks.authControllerLogout).toHaveBeenCalledWith({
			throwOnError: true,
		});
		expect(mocks.authControllerLogout.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.saveSessionToken.mock.invocationCallOrder[0],
		);
		expect(mocks.saveSessionToken).toHaveBeenCalledWith(null);
		expect(mocks.posthogReset).toHaveBeenCalledOnce();
		expect(mocks.queryClient.setQueryData).toHaveBeenCalledWith(
			["auth", "me"],
			null,
		);
		expect(mocks.queryClient.clear).toHaveBeenCalledOnce();
		expect(mocks.routerReplace).toHaveBeenCalledWith("/login");

		act(() => renderer.unmount());
	});

	it("clears local state when the server reports an already-invalid session", async () => {
		mocks.loadSessionToken.mockResolvedValue("test-session");
		mocks.authControllerLogout.mockRejectedValue({
			statusCode: 401,
			message: "Unauthorized",
		});
		let currentAuth: ReturnType<typeof useAuth> | undefined;
		let renderer: ReactTestRenderer;

		await act(async () => {
			renderer = create(
				<AuthProvider>
					<AuthProbe onRender={(auth) => (currentAuth = auth)} />
				</AuthProvider>,
			);
		});
		await act(async () => {
			await currentAuth?.signOut();
		});

		expect(mocks.saveSessionToken).toHaveBeenCalledWith(null);
		expect(mocks.queryClient.clear).toHaveBeenCalledOnce();
		expect(mocks.routerReplace).toHaveBeenCalledWith("/login");

		act(() => renderer.unmount());
	});

	it.each([
		new TypeError("network unavailable"),
		{ statusCode: 503, message: "Unavailable" },
	])("preserves local state when server logout is retryable", async (logoutError) => {
		mocks.loadSessionToken.mockResolvedValue("test-session");
		mocks.useQuery.mockReturnValue({ data: testUser, isPending: false });
		mocks.authControllerLogout.mockRejectedValue(logoutError);
		let currentAuth: ReturnType<typeof useAuth> | undefined;
		let renderer: ReactTestRenderer;

		await act(async () => {
			renderer = create(
				<AuthProvider>
					<AuthProbe onRender={(auth) => (currentAuth = auth)} />
				</AuthProvider>,
			);
		});

		await expect(currentAuth?.signOut()).rejects.toBe(logoutError);
		expect(currentAuth?.isAuthenticated).toBe(true);
		expect(mocks.saveSessionToken).not.toHaveBeenCalled();
		expect(mocks.posthogReset).not.toHaveBeenCalled();
		expect(mocks.queryClient.setQueryData).not.toHaveBeenCalled();
		expect(mocks.queryClient.clear).not.toHaveBeenCalled();
		expect(mocks.routerReplace).not.toHaveBeenCalled();

		act(() => renderer.unmount());
	});
});
