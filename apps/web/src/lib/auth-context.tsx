import {
	authControllerMeOptions,
	getLoginUrl,
	getSignupUrl,
	setOnUnauthorized,
	type UserDto,
	type UserSettingsDto,
	usersControllerGetMySettingsOptions,
} from "@opnshelf/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { env } from "#/env";
import { posthog } from "#/integrations/posthog/provider";
import { currentUserQueryOptions } from "./auth-query";

interface AuthContextType {
	user: UserDto | null;
	userSettings: UserSettingsDto | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	login: (handle: string) => void;
	signup: () => void;
	logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [isLoggingOut, setIsLoggingOut] = useState(false);

	// Fetch current user - catch 401s gracefully to prevent router error boundary loops
	const {
		data: user,
		isLoading,
		isFetchedAfterMount,
	} = useQuery({
		...currentUserQueryOptions(),
		// SSR cannot see the API's host-only session cookie. Verify once on
		// browser mount even when its signed-out result was hydrated as fresh.
		// Navigation still shares the five-minute cache while this stays mounted.
		refetchOnMount: "always",
	});

	// Fetch user settings
	const { data: userSettings } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user,
		retry: false,
		staleTime: 5 * 60 * 1000,
	});

	// The API callback is a browser singleton. Register it after mount so SSR
	// requests never capture their request-scoped QueryClient in global state.
	useEffect(() => {
		setOnUnauthorized(() => {
			queryClient.setQueryData(authControllerMeOptions().queryKey, undefined);
		});

		return () => setOnUnauthorized(null);
	}, [queryClient]);

	const login = useCallback((handle: string) => {
		const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		const loginUrl = getLoginUrl(handle, timezone, undefined);
		window.location.href = loginUrl;
	}, []);

	const signup = useCallback(() => {
		const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		const signupUrl = getSignupUrl(timezone, undefined);
		window.location.href = signupUrl;
	}, []);

	const logout = useCallback(async () => {
		setIsLoggingOut(true);
		try {
			// Call logout endpoint
			const apiUrl = env.VITE_API_URL;
			await fetch(`${apiUrl}/auth/logout`, {
				method: "POST",
				credentials: "include",
			});
		} catch (error) {
			console.error("Logout failed:", error);
		} finally {
			posthog.reset();
			// Clear all queries and user data
			queryClient.clear();
			setIsLoggingOut(false);
			// Redirect to home page
			void navigate({ to: "/" });
		}
	}, [queryClient, navigate]);

	const value: AuthContextType = {
		user: user ?? null,
		userSettings: userSettings ?? null,
		// A signed-out SSR result cannot establish the browser session.
		// Keep cached users visible while the mount-time verification runs.
		isLoading: isLoading || (!user && !isFetchedAfterMount) || isLoggingOut,
		isAuthenticated: !!user,
		login,
		signup,
		logout,
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

export function useUser() {
	const { user } = useAuth();
	return user;
}

export function useIsAuthenticated() {
	const { isAuthenticated } = useAuth();
	return isAuthenticated;
}
