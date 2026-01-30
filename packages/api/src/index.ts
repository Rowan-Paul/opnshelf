// Export generated SDK
export * from './generated';

// Export TanStack Query hooks
export * from './generated/@tanstack/react-query.gen';

// Export client configuration utilities
export { client } from './generated/client.gen';
export { createClient, createConfig } from './generated/client';
export type { Client, ClientOptions, Config, Options } from './generated/client';

// Re-export auth utilities from custom client wrapper
export {
	setOnUnauthorized,
	setSessionToken,
	getSessionToken,
	getAuthUser,
	getLoginUrl,
	logout,
	configureApiClient,
} from './client';

// Backward compatibility wrappers for old API functions
import {
	moviesControllerSearchMovies,
	moviesControllerGetUserMovies,
	moviesControllerMarkWatched,
	moviesControllerUnmarkWatched,
	moviesControllerGetMovieDetails,
} from './generated/sdk.gen';

/**
 * @deprecated Use moviesControllerSearchMovies with TanStack Query instead
 */
export async function searchMovies(query: string) {
	const { data } = await moviesControllerSearchMovies({
		query: { query },
		throwOnError: true,
	});
	return data;
}

/**
 * @deprecated Use moviesControllerGetUserMovies with TanStack Query instead
 */
export async function getUserMovies(userDid: string | undefined) {
	if (!userDid) {
		return [];
	}
	const { data } = await moviesControllerGetUserMovies({
		path: { userDid },
		throwOnError: true,
	});
	return data;
}

/**
 * @deprecated Use moviesControllerMarkWatched with TanStack Query instead
 */
export async function markMovieWatched(movieId: string) {
	const { data } = await moviesControllerMarkWatched({
		body: { movieId },
		throwOnError: true,
	});
	return data;
}

/**
 * @deprecated Use moviesControllerUnmarkWatched with TanStack Query instead
 */
export async function unmarkMovieWatched(movieId: string) {
	const { data } = await moviesControllerUnmarkWatched({
		path: { movieId },
		throwOnError: true,
	});
	return data;
}

/**
 * @deprecated Use moviesControllerGetMovieDetails with TanStack Query instead
 */
export async function getMovieDetails(movieId: string) {
	const { data } = await moviesControllerGetMovieDetails({
		path: { movieId },
		throwOnError: true,
	});
	return data;
}
