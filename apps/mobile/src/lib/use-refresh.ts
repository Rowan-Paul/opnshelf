import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

/**
 * Pull-to-refresh helper for detail screens. Each screen's sections own their
 * own queries, so on pull we refetch every active query rather than wiring up
 * each section's refetch by hand. Returns props for a `<RefreshControl>`.
 */
export function useRefreshActiveQueries() {
	const queryClient = useQueryClient();
	const [refreshing, setRefreshing] = useState(false);
	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await queryClient.refetchQueries({ type: "active" });
		} finally {
			setRefreshing(false);
		}
	};
	return { refreshing, onRefresh };
}
