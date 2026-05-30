import {
	isActiveTraktImportStatus,
	usersControllerFetchMyTraktPublicHistoryMutation,
	usersControllerGetMyCurrentTraktImportOptions,
	usersControllerGetMyCurrentTraktImportQueryKey,
	usersControllerStartMyTraktImportMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}

/**
 * Trakt public-history import: fetch a preview for a username, start the
 * server-side import job, and poll its status while active. Mirrors the web
 * onboarding Trakt step over the shared `@opnshelf/api` procedures. (The
 * backend has no CSV import; it fetches and TMDB-resolves a public Trakt
 * profile server-side.)
 */
export function useTraktImport() {
	const { isAuthenticated } = useAuth();
	const queryClient = useQueryClient();
	const toast = useToast();

	const currentQuery = useQuery({
		...usersControllerGetMyCurrentTraktImportOptions(),
		enabled: isAuthenticated,
		refetchInterval: (query) => {
			const status = query.state.data?.status;
			return status && isActiveTraktImportStatus(status) ? 3000 : false;
		},
	});

	const fetchPreview = useMutation({
		mutationKey: ["trakt", "fetchPreview"],
		...usersControllerFetchMyTraktPublicHistoryMutation(),
		onError: (error) =>
			toast.error(
				errorMessage(
					error,
					"Couldn't fetch that Trakt profile. Check the username and try again.",
				),
			),
	});

	const startImport = useMutation({
		mutationKey: ["trakt", "startImport"],
		...usersControllerStartMyTraktImportMutation(),
		onSuccess: () => {
			toast.success("Import started");
			queryClient.invalidateQueries({
				queryKey: usersControllerGetMyCurrentTraktImportQueryKey(),
			});
		},
		onError: (error) =>
			toast.error(errorMessage(error, "Failed to start import")),
	});

	return {
		currentJob: currentQuery.data ?? null,
		fetchPreview,
		startImport,
	};
}
