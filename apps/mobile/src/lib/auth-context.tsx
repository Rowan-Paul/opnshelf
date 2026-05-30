import {
	authControllerMe,
	authControllerMeQueryKey,
	authControllerRegister,
	getLoginUrl,
	type RegisterDto,
	setOnUnauthorized,
	type UserDto,
} from "@opnshelf/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { loadSessionToken, saveSessionToken } from "@/lib/api";
import { posthog } from "@/lib/posthog";

/** Where the PDS OAuth flow redirects back into the app. */
const AUTH_REDIRECT_URL = "opnshelf://auth/complete";

interface AuthContextType {
	/** The current user, or `null` when signed out. */
	user: UserDto | null;
	/** True while the initial session restore / `me` fetch is in flight. */
	isLoading: boolean;
	/** Convenience flag derived from `user`. */
	isAuthenticated: boolean;
	/** Start the login OAuth flow. Optional handle pre-fills the PDS. */
	login: (handle?: string) => Promise<void>;
	/**
	 * Create a native account on opnshelf's PDS (captcha + invite gated). On
	 * success the session is established but the account still needs email
	 * verification before it can write records — callers route to /verify-email.
	 */
	register: (input: RegisterDto) => Promise<void>;
	/** Explicit sign-out: clears the persisted token + query cache. */
	signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Best-effort timezone detection for the login/signup URLs. */
function detectTimezone(): string | undefined {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
	} catch {
		return undefined;
	}
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();

	// Gate the `me` query on (a) the API client being ready with a restored
	// token and (b) a token actually existing. Without a token the request is
	// guaranteed to 401, so we skip it entirely.
	const [isInitialized, setIsInitialized] = useState(false);
	const [hasSessionToken, setHasSessionToken] = useState(false);

	// Use queryKey + a manual queryFn (rather than spreading the generated
	// `...authControllerMeOptions()`) to avoid a query-core type mismatch between
	// the workspace and the generated client. 401s resolve to `null`.
	const { data: user, isPending: isUserPending } = useQuery({
		queryKey: authControllerMeQueryKey(),
		queryFn: async ({ signal }) => {
			const { data } = await authControllerMe({ signal, throwOnError: true });
			return data ?? null;
		},
		staleTime: 5 * 60 * 1000,
		retry: false,
		enabled: isInitialized && hasSessionToken,
		refetchOnReconnect: false,
		refetchOnWindowFocus: false,
	});

	// Restore the persisted token on mount and apply it to the API client.
	useEffect(() => {
		loadSessionToken().then((token) => {
			setHasSessionToken(!!token);
			setIsInitialized(true);
		});
	}, []);

	const clearSession = useCallback(async () => {
		await saveSessionToken(null);
		setHasSessionToken(false);
		const meKey = authControllerMeQueryKey();
		queryClient.setQueryData(meKey, null);
		queryClient.removeQueries({ queryKey: meKey });
	}, [queryClient]);

	// Centralized 401 handling: the API client invokes this on any 401. We clear
	// the session and route to login with a reason so the screen can explain it.
	useEffect(() => {
		setOnUnauthorized(() => {
			void clearSession().then(() => {
				router.replace({
					pathname: "/login",
					params: { reason: "session_expired" },
				});
			});
		});
		return () => setOnUnauthorized(null);
	}, [clearSession]);

	// Run the OAuth web flow and persist the returned session token.
	const runAuthFlow = useCallback(
		async (authUrl: string) => {
			const result = await WebBrowser.openAuthSessionAsync(
				authUrl,
				AUTH_REDIRECT_URL,
			);
			if (result.type !== "success") {
				return;
			}
			const url = new URL(result.url);
			const session = url.searchParams.get("session");
			if (!session) {
				throw new Error("No session returned from auth flow");
			}
			await saveSessionToken(session);
			setHasSessionToken(true);
			// Fetch the user immediately so callers can route on the result.
			const fetchedUser = await queryClient.fetchQuery({
				queryKey: authControllerMeQueryKey(),
				queryFn: async () => {
					const { data } = await authControllerMe({ throwOnError: true });
					return data ?? null;
				},
				staleTime: 0,
			});
			if (fetchedUser) {
				posthog?.identify(fetchedUser.did, {
					$set: { handle: fetchedUser.handle, did: fetchedUser.did },
					$set_once: { first_login_date: new Date().toISOString() },
				});
				posthog?.capture("user_logged_in", { handle: fetchedUser.handle });
			}
		},
		[queryClient],
	);

	const login = useCallback(
		async (handle?: string) => {
			const loginUrl = getLoginUrl(
				handle?.trim() || undefined,
				detectTimezone(),
				"mobile",
			);
			await runAuthFlow(loginUrl);
		},
		[runAuthFlow],
	);

	const register = useCallback(
		async (input: RegisterDto) => {
			const { data } = await authControllerRegister({
				body: input,
				throwOnError: true,
			});
			if (!data?.sessionId) {
				throw new Error("No session returned from register");
			}
			// Native apps can't use the httpOnly cookie the backend also sets, so we
			// persist the opaque session id from the body and drive the API client
			// off it (same Bearer-token path as the OAuth flow).
			await saveSessionToken(data.sessionId);
			setHasSessionToken(true);
			const fetchedUser = await queryClient.fetchQuery({
				queryKey: authControllerMeQueryKey(),
				queryFn: async () => {
					const { data } = await authControllerMe({ throwOnError: true });
					return data ?? null;
				},
				staleTime: 0,
			});
			if (fetchedUser) {
				posthog?.identify(fetchedUser.did, {
					$set: { handle: fetchedUser.handle, did: fetchedUser.did },
					$set_once: { first_login_date: new Date().toISOString() },
				});
				posthog?.capture("user_signed_up", { method: "pds_register" });
			}
		},
		[queryClient],
	);

	const signOut = useCallback(async () => {
		await saveSessionToken(null);
		setHasSessionToken(false);
		queryClient.setQueryData(authControllerMeQueryKey(), null);
		queryClient.clear();
		router.replace("/login");
	}, [queryClient]);

	// Loading until the token is restored. If a token exists, also wait for the
	// first `me` fetch to settle (the query is disabled — and thus not pending in
	// a meaningful way — when there's no token, so we only gate on it then).
	const isLoading = !isInitialized || (hasSessionToken && isUserPending);

	const value: AuthContextType = {
		user: user ?? null,
		isLoading,
		isAuthenticated: !!user,
		login,
		register,
		signOut,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
