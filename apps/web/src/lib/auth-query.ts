import {
	authControllerMe,
	authControllerMeOptions,
	isUnauthorizedError,
} from "@opnshelf/api";

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
			try {
				const { data } = await authControllerMe({
					...options,
					signal: context.signal,
					throwOnError: true,
				});
				return data ?? null;
			} catch (error) {
				// Cache signed-out state too; public navigation must not retry 401s.
				if (isUnauthorizedError(error)) return null;
				throw error;
			}
		},
		staleTime: 5 * 60 * 1000,
		retry: false as const,
	};
}
