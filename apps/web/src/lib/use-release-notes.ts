import {
	type ReleaseNotesOptions,
	useReleaseNotesState,
} from "@opnshelf/api/release-notes-react";
import { useAuth } from "./auth-context";
import { releaseNotesOptions } from "./release-notes-query";

export function useReleaseNotes(options: ReleaseNotesOptions = {}) {
	const { user } = useAuth();
	return useReleaseNotesState(user?.did, releaseNotesOptions(), options);
}
