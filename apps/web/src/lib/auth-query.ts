import {
	authControllerMe,
	authControllerMeOptions,
	isUnauthorizedError,
} from "@opnshelf/api";

/** Longest the session check may hang before it counts as unavailable. */
export const SESSION_CHECK_DEADLINE_MS = 10_000;

/** One freshness policy for route guards and the mounted auth provider. */
export function currentUserQueryOptions(
	options?: Parameters<typeof authControllerMeOptions>[0],
) {
	const generated = authControllerMeOptions(options);
	return {
		queryKey: generated.queryKey,
		queryFn: async (
			context: Parameters<NonNullable<typeof generated.queryFn>>[0],
		) => {
			// The auth provider stays pending until this settles, so a request
			// that never answers must still fail. Keep React Query's own
			// cancellation working alongside the deadline.
			const deadline = new AbortController();
			const timer = setTimeout(
				() =>
					deadline.abort(
						new DOMException("Session check timed out", "TimeoutError"),
					),
				SESSION_CHECK_DEADLINE_MS,
			);
			try {
				const { data } = await authControllerMe({
					...options,
					signal: AbortSignal.any([context.signal, deadline.signal]),
					throwOnError: true,
				});
				return data ?? null;
			} catch (error) {
				// Cache signed-out state too; public navigation must not retry 401s.
				if (isUnauthorizedError(error)) return null;
				throw error;
			} finally {
				clearTimeout(timer);
			}
		},
		staleTime: 5 * 60 * 1000,
		retry: false as const,
	};
}
