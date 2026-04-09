import { configureApiClient, setOnUnauthorized } from "@opnshelf/api";
import { env } from "#/env";

// Configure the API client with the base URL from environment
export function setupApiClient() {
	const apiUrl = env.VITE_API_URL;

	// Configure the base URL
	configureApiClient(apiUrl);

	// Set up unauthorized handler - redirects to login on 401
	setOnUnauthorized(() => {
		// In a real app, you might want to redirect to login
		// For now, we'll just log it
		console.warn("Unauthorized - redirecting to login");
		// redirect({ to: '/login' })
	});

	return { apiUrl };
}

// Export configured status
export const apiConfig = {
	baseUrl: env.VITE_API_URL,
};
