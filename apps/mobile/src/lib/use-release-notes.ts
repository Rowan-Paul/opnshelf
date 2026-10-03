import { fetchReleaseNotes } from "@opnshelf/api";
import {
	type ReleaseNotesOptions,
	useReleaseNotesState,
} from "@opnshelf/api/release-notes-react";
import { useAuth } from "./auth-context";
import { env } from "./env";

const releaseNotesOptions = () => ({
	queryKey: ["release-notes", env.siteUrl],
	queryFn: ({ signal }: { signal: AbortSignal }) =>
		fetchReleaseNotes(env.siteUrl, signal),
	staleTime: 60_000,
	refetchInterval: 60_000,
});

export function useReleaseNotes(options: ReleaseNotesOptions = {}) {
	const { user } = useAuth();
	return useReleaseNotesState(user?.did, releaseNotesOptions(), options);
}
