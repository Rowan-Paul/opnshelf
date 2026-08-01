import {
	type AccountDeletionJobDto,
	isActiveAccountDeletionStatus,
	isUnauthorizedError,
	usersControllerGetMyAccountDeletionOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";

/**
 * The current account-deletion job, read from the server instead of component
 * state, so a running PDS deletion is still known after the app is closed and
 * reopened. Polls while the job is active and signs out once it finishes.
 */
export function useAccountDeletionJob(): AccountDeletionJobDto | null {
	const { isAuthenticated, signOut } = useAuth();

	const { data, error } = useQuery({
		...usersControllerGetMyAccountDeletionOptions(),
		enabled: isAuthenticated,
		refetchInterval: (query) =>
			query.state.data && isActiveAccountDeletionStatus(query.state.data.status)
				? 2000
				: false,
		retry: false,
	});

	const job = data ?? null;
	const sawActiveJob = useRef(false);

	useEffect(() => {
		if (job && isActiveAccountDeletionStatus(job.status)) {
			sawActiveJob.current = true;
		}
		if (job?.status === "completed") {
			void signOut();
		}
	}, [job, signOut]);

	useEffect(() => {
		// The backend deletes the user and revokes the session atomically with (or
		// right after) marking the job completed. If our next poll arrives after
		// revocation, we get a 401 — treat that as "done" and sign out.
		if (error && sawActiveJob.current && isUnauthorizedError(error)) {
			void signOut();
		}
	}, [error, signOut]);

	return job;
}

export function isAccountDeletionRunning(
	job: AccountDeletionJobDto | null,
): boolean {
	return !!job && isActiveAccountDeletionStatus(job.status);
}
