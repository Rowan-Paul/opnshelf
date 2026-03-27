import type { UserDto } from "@opnshelf/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authControllerMeOptions, authControllerMeQueryKey, getLoginUrl } from "@opnshelf/api";
import * as WebBrowser from "expo-web-browser";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { loadSessionToken, saveSessionToken } from "@/lib/api";

interface AuthContextType {
	user: UserDto | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	login: (handle?: string) => Promise<void>;
	logout: () => Promise<void>;
	handleAuthCallback: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function isUnauthorizedError(error: unknown): boolean {
	if (!error || typeof error !== "object") {
		return false;
	}

	const statusCode = (error as { statusCode?: unknown }).statusCode;
	return statusCode === 401;
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const [isInitialized, setIsInitialized] = useState(false);
	const [hasSessionToken, setHasSessionToken] = useState(false);
	const [hasResolvedInitialAuth, setHasResolvedInitialAuth] = useState(false);
	const queryClient = useQueryClient();

	const {
		data: user,
		isLoading: isUserLoading,
		isError: isUserError,
		error: userError,
		status: userStatus,
		fetchStatus: userFetchStatus,
	} = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
		enabled: isInitialized && hasSessionToken,
		refetchOnMount: false,
		refetchOnReconnect: false,
		refetchOnWindowFocus: false,
	});

	useEffect(() => {
		loadSessionToken().then((token) => {
			setHasSessionToken(!!token);
			setIsInitialized(true);
		});
	}, []);

	useEffect(() => {
		if (user) {
			setHasSessionToken(true);
		}
	}, [user]);

	useEffect(() => {
		if (!isInitialized) {
			return;
		}

		if (!hasSessionToken) {
			setHasResolvedInitialAuth(true);
			return;
		}

		if (userStatus === "success" || userStatus === "error") {
			setHasResolvedInitialAuth(true);
		}
	}, [isInitialized, hasSessionToken, userStatus]);

	useEffect(() => {
		if (isUserError) {
			if (isUnauthorizedError(userError)) {
				void saveSessionToken(null);
				setHasSessionToken(false);
				const meQueryKey = authControllerMeQueryKey();
				queryClient.setQueryData(meQueryKey, null);
				queryClient.removeQueries({ queryKey: meQueryKey });
			}
		}
	}, [isUserError, queryClient, userError]);

	const login = useCallback(async (handle?: string) => {
		const loginUrl = getLoginUrl(handle, undefined, "mobile");
		const result = await WebBrowser.openAuthSessionAsync(
			loginUrl,
			"opnshelf://auth/complete"
		);

		if (result.type === "success") {
			const url = new URL(result.url);
			const token = url.searchParams.get("token");
			if (token) {
				await handleAuthCallback(token);
			}
		}
	}, []);

	const logout = useCallback(async () => {
		await saveSessionToken(null);
		setHasSessionToken(false);
		const meQueryKey = authControllerMeQueryKey();
		queryClient.setQueryData(meQueryKey, null);
		queryClient.clear();
	}, [queryClient]);

	const handleAuthCallback = useCallback(
		async (token: string) => {
			await saveSessionToken(token);
			setHasSessionToken(true);
			await queryClient.invalidateQueries({ queryKey: authControllerMeQueryKey() });
		},
		[queryClient]
	);

	const isLoading = !isInitialized || (hasSessionToken && !hasResolvedInitialAuth);

	const value: AuthContextType = {
		user: user ?? null,
		isLoading,
		isAuthenticated: !!user,
		login,
		logout,
		handleAuthCallback,
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
