import {
	authControllerMe,
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
	useState,
} from "react";
import { env } from "#/env";

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
	const { data: user, isLoading } = useQuery({
		queryKey: authControllerMeOptions().queryKey,
		queryFn: async ({ queryKey, signal }) => {
			try {
				const { data } = await authControllerMe({
					...queryKey[0],
					signal,
					throwOnError: true,
				});
				return data ?? null;
			} catch (error) {
				if (
					typeof error === "object" &&
					error !== null &&
					("status" in error || "statusCode" in error) &&
					((error as Record<string, unknown>).status === 401 ||
						(error as Record<string, unknown>).statusCode === 401)
				) {
					return null;
				}
				throw error;
			}
		},
		retry: false,
		staleTime: 5 * 60 * 1000, // 5 minutes
	});

	// Fetch user settings
	const { data: userSettings } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user,
		retry: false,
		staleTime: 5 * 60 * 1000,
	});

	// Handle unauthorized responses
	setOnUnauthorized(() => {
		// Clear user data on 401
		queryClient.setQueryData(authControllerMeOptions().queryKey, undefined);
	});

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
		isLoading: isLoading || isLoggingOut,
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
