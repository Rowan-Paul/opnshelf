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

export function AuthProvider({ children }: { children: ReactNode }) {
	const [isInitialized, setIsInitialized] = useState(false);
	const queryClient = useQueryClient();

	const { data: user, isLoading: isUserLoading } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
		enabled: isInitialized,
	});

	useEffect(() => {
		loadSessionToken().then(() => {
			setIsInitialized(true);
		});
	}, []);

	const login = useCallback(async (handle?: string) => {
		const loginUrl = getLoginUrl(handle);
		const result = await WebBrowser.openAuthSessionAsync(
			loginUrl,
			"opnshelf://auth/callback"
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
		// Set user to null immediately to update UI, then remove queries
		// Use the exact query key structure created by authControllerMeQueryKey()
		const meQueryKey = authControllerMeQueryKey();
		queryClient.setQueryData(meQueryKey, null);
		queryClient.removeQueries({ queryKey: meQueryKey });
		queryClient.removeQueries({ queryKey: ["moviesControllerGetUserMovies"] });
	}, [queryClient]);

	const handleAuthCallback = useCallback(async (token: string) => {
		await saveSessionToken(token);
		// Refetch user to update auth state
		await queryClient.invalidateQueries({ queryKey: authControllerMeQueryKey() });
	}, [queryClient]);

	const value: AuthContextType = {
		user: user ?? null,
		isLoading: !isInitialized || isUserLoading,
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
