import {
	type ShowProgressBatchResponseDto,
	showsControllerGetShowProgressOptions,
} from "@opnshelf/api";
import { hashKey, useQueries } from "@tanstack/react-query";
import {
	createContext,
	createElement,
	type ReactNode,
	useContext,
	useMemo,
} from "react";
import { useAuth } from "@/lib/auth-context";

const MAX_BATCH_SIZE = 50;

export type ShowProgressQuery = {
	data: ShowProgressBatchResponseDto | undefined;
	isLoading: boolean;
	isError: boolean;
};

const ShowProgressScopeContext = createContext<ShowProgressQuery | null>(null);

function canonicalShowIds(showIds: Array<string | number>) {
	return [...new Set(showIds.map(String))].sort();
}

/** Fetches a known visible set; TanStack Query remains the only progress cache. */
export function useShowProgress(
	showIds: Array<string | number>,
): ShowProgressQuery {
	const { isAuthenticated, user } = useAuth();
	const viewerDid = isAuthenticated ? user?.did : undefined;
	const idsKey = canonicalShowIds(showIds).join(",");
	const ids = useMemo(() => (idsKey ? idsKey.split(",") : []), [idsKey]);
	const batches = useMemo(
		() =>
			Array.from(
				{ length: Math.ceil(ids.length / MAX_BATCH_SIZE) },
				(_, index) =>
					ids.slice(index * MAX_BATCH_SIZE, (index + 1) * MAX_BATCH_SIZE),
			),
		[ids],
	);
	const queries = useQueries({
		queries: batches.map((batch) => ({
			...showsControllerGetShowProgressOptions({ query: { showIds: batch } }),
			// Progress is viewer-scoped but the URL carries no DID, so two viewers
			// asking for the same shows would otherwise share one cache entry.
			// Hashing the viewer in separates them without disturbing the generated
			// key, which invalidation and the generated queryFn both read.
			queryKeyHashFn: (key: readonly unknown[]) => hashKey([...key, viewerDid]),
			enabled: Boolean(viewerDid),
			staleTime: 30_000,
		})),
	});
	const isError = queries.some((query) => query.isError);

	return {
		data:
			queries.length && !isError
				? { items: queries.flatMap((query) => query.data?.items ?? []) }
				: undefined,
		isLoading: queries.some((query) => query.isLoading),
		isError,
	};
}

/** Scopes a complete visible poster list to one owner-created batch. */
export function ShowProgressScope({
	showIds,
	children,
}: {
	showIds: Array<string | number>;
	children: ReactNode;
}) {
	const progress = useShowProgress(showIds);
	return createElement(
		ShowProgressScopeContext.Provider,
		{ value: progress },
		children,
	);
}

/** Reads nearest list-owner progress, or makes the allowed one-show fallback. */
export function useShowProgressForShow(
	showId: string | number,
	enabled = true,
): ShowProgressQuery {
	const scope = useContext(ShowProgressScopeContext);
	const standalone = useShowProgress(scope || !enabled ? [] : [showId]);
	return enabled && scope ? scope : standalone;
}

export function findShowProgress(
	data: ShowProgressBatchResponseDto | undefined,
	showId: string | number,
) {
	return data?.items.find((item) => item.showId === String(showId));
}
