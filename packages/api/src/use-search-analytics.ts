import { useEffect, useRef } from "react";

/** One completed first-page search per query/tab visit. Query text stays local. */
export function useSearchAnalytics({
	query,
	tab,
	surface,
	ready,
	resultCount,
	enabled = true,
	page = 1,
	capture,
}: {
	query: string;
	tab: string;
	surface: string;
	ready: boolean;
	resultCount: number;
	enabled?: boolean;
	page?: number;
	capture: (event: string, properties: Record<string, string | number>) => void;
}) {
	const previous = useRef<string | null>(null);
	useEffect(() => {
		if (!enabled || !query.trim()) {
			previous.current = null;
			return;
		}
		if (!ready || page !== 1) return;
		const key = JSON.stringify([query, tab, surface]);
		if (previous.current === key) return;
		previous.current = key;
		capture("search_performed", {
			surface,
			tab,
			query_length: query.trim().length,
			result_count: resultCount,
		});
	}, [query, tab, surface, ready, resultCount, enabled, page, capture]);
}
