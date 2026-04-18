import {
	authControllerMeOptions,
	getLoginUrl,
	getSignupUrl,
	setOnUnauthorized,
	type UserDto,
} from "@opnshelf/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
	isLoading: boolean;
	isAuthenticated: boolean;
	login: (handle: string) => void;
	signup: () => void;
	logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();
	const [isLoggingOut, setIsLoggingOut] = useState(false);

	// Fetch current user
	const { data: user, isLoading } = useQuery({
		...authControllerMeOptions(),
		retry: false,
		staleTime: 5 * 60 * 1000, // 5 minutes
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
		}
	}, [queryClient]);

	const value: AuthContextType = {
		user: user ?? null,
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
