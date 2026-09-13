import {
	authControllerLogout,
	authControllerMe,
	authControllerMeQueryKey,
	authControllerRegister,
	getLoginUrl,
	getSessionToken,
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
	useRef,
	useState,
} from "react";
import { loadSessionToken, saveSessionToken } from "@/lib/api";
import { AuthFlowError } from "@/lib/auth-error";
import {
	beginHandoff,
	clearHandoff,
	pendingRedemption,
	redeemHandoffCode,
} from "@/lib/auth-handoff";
import { NoPendingHandoffError } from "@/lib/handoff-error";
import { posthog } from "@/lib/posthog";
import { setWidgetHandle } from "../../modules/widget-bridge";

/** Where the PDS OAuth flow redirects back into the app. */
const AUTH_REDIRECT_URL = "opnshelf://auth/complete";

interface AuthContextType {
	/** The current user, or `null` when signed out. */
	user: UserDto | null;
	/** True while the initial session restore / `me` fetch is in flight. */
	isLoading: boolean;
	/** Convenience flag derived from `user`. */
	isAuthenticated: boolean;
	/**
	 * Start the login OAuth flow. Optional handle pre-fills the PDS. Resolves
	 * true only when a session exists afterwards, like runAuthorizationUrl.
	 */
	login: (handle?: string) => Promise<boolean>;
	/** Continue an authorization request already created by the backend. */
	runAuthorizationUrl: (authorizationUrl: string) => Promise<boolean>;
	/**
	 * Persist a session id returned by the OAuth flow and fetch the user. Used by
	 * the in-app auth session result and by the `auth/complete` deep-link route
	 * (Android sometimes delivers the redirect there instead of resolving the
	 * web auth session). Returns the fetched user so callers can route on it.
	 */
	completeSession: (sessionId: string) => Promise<UserDto | null>;
	/**
	 * Redeem a Mobile Handoff Code from the `auth/complete` redirect (ADR 0026)
	 * for its session, then complete like `completeSession`.
	 */
	completeHandoff: (code: string) => Promise<UserDto | null>;
	/**
	 * Create a native account on opnshelf's PDS (captcha + invite gated). On
	 * success the session is established but the account still needs email
	 * verification before it can write records — callers route to /verify-email.
	 */
	register: (input: RegisterDto) => Promise<void>;
	/** Explicit sign-out: clears the persisted token + query cache. */
	signOut: () => Promise<void>;
}

/**
 * How long to wait for a sign-in this path did not complete to land a session
 * somewhere else. Long enough for the auth/complete deep-link route to run its
 * exchange over a slow network, short enough that a real cancellation does not
 * feel stuck.
 */
const SETTLE_TIMEOUT_MS = 3000;
const SETTLE_POLL_MS = 150;

const AuthContext = createContext<AuthContextType | null>(null);

/** Best-effort timezone detection for the login/signup URLs. */
function detectTimezone(): string | undefined {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
	} catch {
		return undefined;
	}
}

function isUnauthorizedApiError(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	const apiError = error as Record<string, unknown>;
	return apiError.status === 401 || apiError.statusCode === 401;
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();

	// Gate the `me` query on (a) the API client being ready with a restored
	// token and (b) a token actually existing. Without a token the request is
	// guaranteed to 401, so we skip it entirely.
	const [isInitialized, setIsInitialized] = useState(false);
	const [hasSessionToken, setHasSessionToken] = useState(false);
	const isExpiringSession = useRef(false);

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
		let isMounted = true;

		void loadSessionToken().then(
			(token) => {
				if (!isMounted) return;
				setHasSessionToken(!!token);
				setIsInitialized(true);
			},
			() => {
				console.error("Failed to restore the persisted session");
				if (!isMounted) return;
				setHasSessionToken(false);
				setIsInitialized(true);
			},
		);

		return () => {
			isMounted = false;
		};
	}, []);

	const resetIdentityCache = useCallback(async () => {
		await queryClient.cancelQueries();
		queryClient.clear();
	}, [queryClient]);

	const clearSession = useCallback(async () => {
		await saveSessionToken(null);
		posthog?.reset();
		await resetIdentityCache();
		setHasSessionToken(false);
	}, [resetIdentityCache]);

	// Centralized 401 handling: the API client invokes this on any 401. We clear
	// the session and route to login with a reason so the screen can explain it.
	// Guests have no session to expire — a stray 401 from an auth-only endpoint
	// must not bounce them to login, so bail when there's no token.
	useEffect(() => {
		setOnUnauthorized(() => {
			if (!getSessionToken() || isExpiringSession.current) return;
			isExpiringSession.current = true;
			void clearSession().then(
				() => {
					router.replace({
						pathname: "/login",
						params: { reason: "session_expired" },
					});
				},
				() => {
					isExpiringSession.current = false;
					console.error("Failed to clear the expired session");
				},
			);
		});
		return () => setOnUnauthorized(null);
	}, [clearSession]);

	// Persist a session id and fetch the user. Shared by the in-app auth session
	// result and the `auth/complete` deep-link route.
	const completeSession = useCallback(
		async (sessionId: string): Promise<UserDto | null> => {
			await resetIdentityCache();
			await saveSessionToken(sessionId);
			isExpiringSession.current = false;
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
					$set_once: { first_login_date: new Date().toISOString() },
				});
				posthog?.capture("user_logged_in");
			}
			return fetchedUser;
		},
		[queryClient, resetIdentityCache],
	);

	const completeHandoff = useCallback(
		async (code: string): Promise<UserDto | null> => {
			const sessionId = await redeemHandoffCode(code);
			return completeSession(sessionId);
		},
		[completeSession],
	);

	/**
	 * Wait for a sign-in this path did not complete to settle somewhere else,
	 * and report whether it did.
	 *
	 * The browser closing is not the end of the story on Android: the redirect
	 * can reach the `auth/complete` deep-link route *as well as* resolving here,
	 * and that route completes the sign-in in parallel. Concluding "not signed
	 * in" the moment the browser closes reports a failure for a sign-in that is
	 * a few hundred milliseconds from succeeding - and clearing the handoff
	 * first takes the verifier that route is about to redeem with.
	 *
	 * Costs up to SETTLE_TIMEOUT_MS on a genuine cancellation, and returns the
	 * instant a session appears, so the path that matters stays fast.
	 */
	const settleElsewhere = useCallback(async (tokenBefore: string | null) => {
		// Join the other path if it is already exchanging, rather than racing a
		// clock it knows nothing about: a slow network can push that exchange past
		// the whole budget, and the user would be told sign-in failed while it was
		// still succeeding.
		const pending = pendingRedemption();
		if (pending) await pending.catch(() => undefined);

		const deadline = Date.now() + SETTLE_TIMEOUT_MS;
		while (Date.now() < deadline) {
			// A *different* token, not merely any token: a stale one survives a
			// failed `me` fetch, and treating that as success turns a cancelled
			// sign-in into a silent bounce back to the signed-out home screen.
			const token = await loadSessionToken();
			if (token && token !== tokenBefore) return true;
			await new Promise((resolve) => setTimeout(resolve, SETTLE_POLL_MS));
		}
		// Nobody completed it, so the handoff is genuinely spent.
		await clearHandoff();
		return false;
	}, []);

	/**
	 * Run the OAuth web flow and persist the returned session token.
	 *
	 * Returns true only when a session exists afterwards, whichever path
	 * produced it. Callers render failure on false, so a false that merely
	 * means "not completed *here*" becomes a wrong error message - which is
	 * what it did on Android, at three separate call sites.
	 */
	const runAuthFlow = useCallback(
		async (authUrl: string) => {
			// Snapshot first: settling compares against this rather than asking
			// whether any token exists.
			const tokenBefore = await loadSessionToken();
			const result = await WebBrowser.openAuthSessionAsync(
				authUrl,
				AUTH_REDIRECT_URL,
			);
			if (result.type !== "success") {
				return settleElsewhere(tokenBefore);
			}
			const url = new URL(result.url);
			const error = url.searchParams.get("error");
			if (error) {
				await clearHandoff();
				// Typed so callers can tell the user what actually went wrong
				// instead of falling back to "couldn't sign in".
				throw new AuthFlowError(error);
			}
			const code = url.searchParams.get("code");
			if (code) {
				try {
					await completeHandoff(code);
				} catch (error) {
					if (!(error instanceof NoPendingHandoffError)) throw error;
					// Something else took the verifier, or there never was one. Both
					// look identical from here, so wait and see whether a session
					// lands rather than guessing.
					return settleElsewhere(tokenBefore);
				}
				return true;
			}
			// Legacy handoff: a backend that predates the handoff code still sends
			// the session id itself. Remove once every deployment mints codes.
			const session = url.searchParams.get("session");
			if (!session) {
				await clearHandoff();
				throw new Error("No session returned from auth flow");
			}
			await clearHandoff();
			await completeSession(session);
			return true;
		},
		[completeHandoff, completeSession, settleElsewhere],
	);

	const login = useCallback(
		async (handle?: string) => {
			const codeChallenge = await beginHandoff();
			const loginUrl = getLoginUrl(
				handle?.trim() || undefined,
				detectTimezone(),
				"mobile",
				codeChallenge ?? undefined,
			);
			return runAuthFlow(loginUrl);
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
			await resetIdentityCache();
			await saveSessionToken(data.sessionId);
			isExpiringSession.current = false;
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
					$set_once: { first_login_date: new Date().toISOString() },
				});
				posthog?.capture("user_signed_up", { method: "pds_register" });
			}
		},
		[queryClient, resetIdentityCache],
	);

	const signOut = useCallback(async () => {
		try {
			await authControllerLogout({ throwOnError: true });
		} catch (error) {
			// Best-effort revocation: an already-invalid session is effectively
			// revoked, and a network/5xx failure must not trap an offline user in a
			// signed-in state — the server session expires by TTL regardless.
			if (!isUnauthorizedApiError(error)) {
				console.error("Failed to revoke the server session", error);
			}
		}
		await saveSessionToken(null);
		posthog?.reset();
		await resetIdentityCache();
		setHasSessionToken(false);
		router.replace("/login");
	}, [resetIdentityCache]);

	// Loading until the token is restored. If a token exists, also wait for the
	// first `me` fetch to settle (the query is disabled — and thus not pending in
	// a meaningful way — when there's no token, so we only gate on it then).
	const isLoading = !isInitialized || (hasSessionToken && isUserPending);

	// Point the Home-Screen Widget at the signed-in user once auth settles.
	// `user` flips to null on sign-out, session expiry, and account switch,
	// which clears the widget back to its sign-in placeholder. Gated on
	// isLoading so a cold start doesn't briefly wipe the stored handle before
	// the restored session resolves.
	useEffect(() => {
		if (isLoading) return;
		setWidgetHandle(user?.handle ?? null);
	}, [isLoading, user?.handle]);

	const value: AuthContextType = {
		user: user ?? null,
		isLoading,
		isAuthenticated: !!user,
		login,
		completeSession,
		completeHandoff,
		runAuthorizationUrl: runAuthFlow,
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
